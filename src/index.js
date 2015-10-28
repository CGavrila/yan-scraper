'use strict';

import Deque from 'collections/deque';
import * as request from 'request';
import _ from 'lodash';
import * as cheerio from 'cheerio';
var debug = require('debug')('Scraper');
var EventEmitter = require('events').EventEmitter;

let _singleton = Symbol();

/**
 *
 * Singleton class used to scrape websites based on templates and a queue.
 *  - the queue contains the URLs which will be retrieved and then processed as defined by its matching template
 *  - a template is a set of rules which dictate how often a certain type of website can be accessed and what
 *    happens with its response
 *
 * A more hands-on example:
 * You want to scrape data from amazon.com, so what you have to do is to instantiate the Scraper class, add a template
 * and then a couple of pages in the queue that you want scraped.
 *
 * ------------------------------------------------------------------------
 * var scraper = Scraper.instance;
 * scraper.addTemplate({
 *   name: 'Amazon',
 *   matchesFormat: function(url) {
 *       return url.toLowerCase().indexOf('amazon.com') !== -1;
 *   },
 *   callback: function(body, $) {
 *       return { body: body, provider: 'CNN' };
 *   },
 *   interval: 1000
 * });
 *
 * scraper.queue('https://www.amazon.com/product/whatever');
 * ------------------------------------------------------------------------
 *
 */
class Scraper extends EventEmitter {

    constructor(singletonToken) {
        super();
        if (_singleton !== singletonToken)
            throw new Error('Scraper is a singleton class, cannot instantiate directly.');

        this.templates = {};
        this.deque = new Deque();
        this.options = {};
    }

    static get instance() {
        if(!this[_singleton])
            this[_singleton] = new Scraper(_singleton);

        return this[_singleton]
    }

    /**
     * Used to destroy the current instance of the class (it's a Singleton).
     * Particularly useful for testing.
     */
    static destroyInstance() {
        this[_singleton] = null;
    }

    /**
     * Adds a template to the scraper.
     *
     * @param {object} template - The properties of the template, including name, matchesFormat, interval and callback.
     */
    addTemplate(template) {
        if (!template.name) throw new Error('Template name is missing.');
        if (!template.callback) throw new Error('Template callback is missing.');
        if (!template.matchesFormat) throw new Error('Template matchesFormat property is missing.');
        if (template.name in this.templates) throw new Error('Template already exists.');

        if (!('interval' in template)) template.interval = 0;

        this.templates[template.name] = template;
    }

    /**
     * Retrieves the current templates used by the scraper.
     *
     * @returns {{}|*} - An array of objects.
     */
    getTemplates() {
        return this.templates;
    }

    /**
     * Sets the options for current instance.
     *
     * @param options {Object}
     */
    setOptions(options) {
        this.options = options;
    }

    /**
     * Retrieves the current options used by the scraper.
     *
     * @returns options {Object}
     */
    getOptions() {
        return this.options;
    }

    /**
     * Retrieves the current queue.
     *
     * @returns {*} - The queue.
     */
    getQueue() {
        return this.deque;
    }

    /**
     * Adds one or multiple URLs to the queue.
     *
     * @param urls {Array|String} - An array of URLs or a single URL as a string.
     * @param priority {Number} - 0 or 1; if 1, then it will be immediately scraped, otherwise it will get in line.
     */
    queue(urls, priority) {
        if (!priority) priority = 0;

        if (_.isArray(urls)) {
            urls.forEach(url => {
               this.deque.push({url: url, priority: priority});
            });
        }
        else {
            this.deque.push({url: urls, priority: priority});
        }
    }

    /**
     * Retrives the waiting times (in ms) for all templates.
     */
    getWaitTimes() {
        var that = this;
        let waitTimes = {};
        _.forEach(this.templates, function(template) {
            let waitTime = (template.lastUsed - Date.now() + that._determineInterval(template)) || 0; // 0 for when the template was not used
            waitTimes[template.name] = Math.max(waitTime, 0);
        });
        return waitTimes;
    }

    /**
     *
     * Starts the whole process of looping through the queue.
     *
     * @param options {Object} (optional)
     */
    start(options) {
        if (options) this.options = options;

        setTimeout(this._processNextInQueue.bind(this), 0);
    }

    /**
     * Processes one element of the queue at a time.
     *
     * Calls itself recursively, so it should never stop trying to process stuff in the queue,
     * for as long as the application is running.
     *
     * @private
     */
    _processNextInQueue() {
        let that = this;

        if (this.deque.length > 0) {
            let queueEntry = this.deque.shift();

            let nextURL = queueEntry.url;
            let nextURLPriority = queueEntry.priority;

            /* Identify the proper callback to be used once the results come in. */
            let matchingTemplate = _.find(this.templates, function(template) {
                return template.matchesFormat(nextURL);
            });

            if (matchingTemplate === undefined) {
                that.emit('unmatched', nextURL);
            }
            else {

                let interval = that._determineInterval(matchingTemplate);

                /*
                 * Computing how much time is needed until the next request for this specific
                 * tuple (url, template) should happen. However, this keeps track of two different
                 * streams: the priority URLs and the regulars. In both cases, it will try to
                 * respect the interval set via the template or this.options.
                 *
                 * Assuming we have the following URLs coming in at the same time- format url(priority):
                 *
                 * url1(0), url2(0), url3(1), url4(1)
                 *
                 * Then url1 and url3 will execute at the same time, and so will url2 and url4, each pair
                 * after the interval set via templates or this.options.
                 */
                let waitTime;
                if (nextURLPriority === 0 && matchingTemplate.lastUsed) {
                    if ((matchingTemplate.lastUsed + interval) < Date.now())
                        waitTime = 0;
                    else
                        waitTime = (matchingTemplate.lastUsed + interval) - Date.now();
                }
                else if (nextURLPriority !== 0 && matchingTemplate.lastUsedPriority) {
                    if ((matchingTemplate.lastUsedPriority + interval) < Date.now())
                        waitTime = 0;
                    else
                        waitTime = (matchingTemplate.lastUsedPriority + interval) - Date.now();
                }
                else {
                    waitTime = 0;
                }

                debug(matchingTemplate.name + ' - ' + matchingTemplate.lastUsed + ' - ' + waitTime);

                /* Keeping track of when the last request to a URL matching the current template
                 * has been made. This is possible to be a date in the future and is NOT precise
                 * to the millisecond, but quite close.
                 *
                 * There are two cases here:
                 *  - the link is a priority (priority > 0)
                 *  - the link is a regular link
                 *
                 *  If the link is either one, it will update lastUsed because this will help with
                 *  balancing the number of requests to being approximately the average imposed by
                 *  the template's interval.
                 *
                 *  If the link has priority > 0, then it will update lastUsedPriority too because
                 *  we don't want priority links to start 100 requests at the same time.
                 */
                matchingTemplate.lastUsed = Date.now() + waitTime;
                if (nextURLPriority !== 0) matchingTemplate.lastUsedPriority = Date.now() + waitTime;

                debug('Next URL (' + waitTime + ' milliseconds wait time) is - ' + nextURL);

                /*  */
                if (nextURLPriority > 0) waitTime = 0;

                setTimeout(function () {
                    that._makeRequest(nextURL, matchingTemplate);
                }, waitTime);

            }
        }

        setTimeout(this._processNextInQueue.bind(this), 0);
    }

    /**
     * Makes a request to a specific URL and then applies the callback specified in its template.
     *
     * @param {String} url - An URL to be requested.
     * @param {Object} template - The corresponding template matching the URL provided.
     * @private
     */
    _makeRequest(url, template) {
        /* TODO: take care of other responses than 200. */

        let that = this;

        request.get(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                debug('Got results for ' + url);
                let result = template.callback(url, body, cheerio.load(body));
                that.emit('result', _.merge(result, { url: url, template: template }));
            }
        });
    }

    /**
     * Determines the interval to wait in-between requests for a particular template.
     *
     * @param template
     * @private
     */
    _determineInterval(template) {
        if (this.options.interval)
            return this.options.interval;
        else if (this.options.maxInterval)
            return Math.min(this.options.maxInterval, template.interval);
        else
            return template.interval;
    }
}

export default Scraper;