'use strict';

import Deque from 'collections/deque';
import * as request from 'request';
import * as _ from 'lodash';
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
     */
    queue(urls) {
        if (_.isArray(urls)) {
            urls.forEach(url => {
               this.deque.push(url);
            });
        }
        else {
            this.deque.push(urls);
        }
    }

    /**
     * Starts the whole process of looping through the queue.
     */
    start() {
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
            let nextURL = this.deque.shift();

            /* Identify the proper callback to be used once the results come in. */
            let matchingTemplate = _.find(this.templates, function(template) {
                return template.matchesFormat(nextURL);
            });

            if (matchingTemplate === undefined) {
                that.emit('unmatched', nextURL);
            }
            else {

                let interval = matchingTemplate.interval;

                /*
                 * Computing how much time is needed until the next request for this specific
                 * tuple (url, template) should happen.
                 *
                 * If the last request happened less time ago than the specified interval or didn't
                 * happen at all until now, then run it straight away.
                 *
                 * Otherwise, set it to run after a while, so that it matches the minimum interval specified.
                 */
                let waitTime;
                if (matchingTemplate.lastUsed) { // basically it it's undefined
                    if ((matchingTemplate.lastUsed + interval) < Date.now())
                        waitTime = 0;
                    else
                        waitTime = (matchingTemplate.lastUsed + interval) - Date.now();
                } else {
                    waitTime = 0;
                }

                debug(matchingTemplate.name + ' - ' + matchingTemplate.lastUsed + ' - ' + waitTime);

                /* Keeping track of when the last request to a URL matching the current template
                 * has been made. This is possible to be a date in the future and is NOT precise
                 * to the millisecond, but quite close. */
                matchingTemplate.lastUsed = Date.now() + waitTime;

                debug('Next URL (' + waitTime + ' milliseconds wait time) is - ' + nextURL);

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
            if (!error && response.statusCode == 200) {
                debug('Got results for ' + url);
                let result = template.callback(url, body, cheerio.load(body));
                that.emit('result', _.merge(result, { url: url, template: template }));
            }
        });
    }
}

export default Scraper;