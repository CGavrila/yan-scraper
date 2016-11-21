/// <reference path="../typings/index.d.ts" />

'use strict';

import * as Immutable from 'immutable';
import * as request from 'request';
import * as _ from 'lodash';
import * as cheerio from 'cheerio';
import * as debug from 'debug';
import {EventEmitter} from 'events';

let scraperDebug = debug('yan-scraper');

/**
 * Used as a template for the websites that will be polled.
 */
export interface Template<T> {
    name: string;
    url?: string;
    matchesFormat: (url: string) => boolean;
    interval?: number;
    callback: (url: string, body: any, $: CheerioStatic) => T;
}

export interface TemplateWrapper<T> extends Template<T> {
    lastUsed: number;
    lastUsedPriority: number;
}

/**
 * Used as a template for the websites that will be polled.
 */
export interface QueueEntry {
    url: string;
    priority: boolean;
}

export interface ScraperOptions {
    interval: number;
    maxInterval?: number;
}

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
class Scraper<T> extends EventEmitter {

    private static _instance;
    private templates: { [name: string]: Template<T> } = {};
    private options: ScraperOptions;
    private queue: Immutable.List<QueueEntry> = Immutable.List<QueueEntry>();

    constructor() {
        super();
        if(Scraper._instance){
            throw new Error("Error: Instantiation failed - use Scraper.getInstance() instead of new.");
        }
    }

    public static getInstance()  {
        return this._instance || (this._instance = new this());

    }

    public static destroyInstance(): void {
        this._instance = null;
    }

    /**
     * Adds a template to the scraper.
     *
     * @param {object} template - The properties of the template, including name, matchesFormat, interval and callback.
     */
    public addTemplate(template: Template<T>) {
        let templateWrapper: TemplateWrapper<T> = <TemplateWrapper<T>> template;

        if (!templateWrapper.name) throw new Error('Template name is missing.');
        if (!templateWrapper.callback) throw new Error('Template callback is missing.');
        if (!templateWrapper.matchesFormat) throw new Error('Template matchesFormat property is missing.');
        if (templateWrapper.name in this.templates) throw new Error('Template already exists.');

        if (!('interval' in templateWrapper)) templateWrapper.interval = 0;

        this.templates[templateWrapper.name] = templateWrapper;
    }

    /**
     * Retrieves the current templates used by the scraper.
     *
     * @returns {{}|*} - An array of objects.
     */
    public getTemplates(): { [name: string]: Template<T> } {
        return this.templates;
    }

    /**
     * Sets the options for current instance.
     *
     * @param options {Object}
     */
    public setOptions(options: ScraperOptions) {
        this.options = options;
    }

    /**
     * Retrieves the current options used by the scraper.
     *
     * @returns options {Object}
     */
    public getOptions(): ScraperOptions {
        return this.options;
    }

    /**
     * Retrieves the current queue.
     *
     * @returns {*} - The queue.
     */
    public getQueue(): Immutable.List<QueueEntry> {
        return this.queue;
    }

    /**
     * Adds one or multiple URLs to the queue.
     *
     * @param url
     * @param priority
     */
    public addToQueue(url: string, priority?: boolean): void {
        if (!priority) priority = false;

        if (_.isArray(url)) {
            _.forEach(url, (url) => {
               this.queue.push(<QueueEntry> { url: url, priority: priority });
            });
        }
        else {
            this.queue.push(<QueueEntry> { url: url, priority: priority });
        }
    }

    /**
     * Retrieves the waiting times (in ms) for all templates.
     */
    public getWaitTimes(): { [name: string]: number } {
        let that = this;
        let waitTimes: { [name: string]: number } = {};
        _.forEach(this.templates, (template: TemplateWrapper<T>) => {
            let waitTime = (template.lastUsed - Date.now() + that.determineInterval(template)) || 0; // 0 for when the template was not used
            waitTimes[template.name] = Math.max(waitTime, 0);
        });
        return waitTimes;
    }

    /**
     *
     * Starts the whole process of looping through the queue.
     *
     * @param options
     */
    public start(options?: ScraperOptions) {
        if (options) this.options = options;

        setTimeout(this.processNextInQueue.bind(this), 0);
    }

    /**
     * Processes one element of the queue at a time.
     *
     * Calls itself recursively, so it should never stop trying to process stuff in the queue,
     * for as long as the application is running.
     *
     * @private
     */
    private processNextInQueue(): void {
        let that: Scraper<T> = this;

        if (this.queue.size > 0) {
            let queueEntry: QueueEntry = this.queue.first();
            this.queue = this.queue.shift();

            let nextURL: string = queueEntry.url;
            let nextURLPriority: boolean = queueEntry.priority;

            /* Identify the proper callback to be used once the results come in. */
            let matchingTemplate: TemplateWrapper<T> = <TemplateWrapper<T>> _.find(this.templates, (template: TemplateWrapper<T>): boolean => {
                return template.matchesFormat(nextURL);
            });

            if (!matchingTemplate) {
                that.emit('unmatched', nextURL);
            }
            else {

                let interval = that.determineInterval(matchingTemplate);

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
                if (nextURLPriority === false && matchingTemplate.lastUsed) {
                    if ((matchingTemplate.lastUsed + interval) < Date.now())
                        waitTime = 0;
                    else
                        waitTime = (matchingTemplate.lastUsed + interval) - Date.now();
                }
                else if (nextURLPriority === true && matchingTemplate.lastUsedPriority) {
                    if ((matchingTemplate.lastUsedPriority + interval) < Date.now())
                        waitTime = 0;
                    else
                        waitTime = (matchingTemplate.lastUsedPriority + interval) - Date.now();
                }
                else {
                    waitTime = 0;
                }

                scraperDebug(matchingTemplate.name + ' - ' + matchingTemplate.lastUsed + ' - ' + waitTime);

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
                if (nextURLPriority === false) matchingTemplate.lastUsedPriority = Date.now() + waitTime;

                scraperDebug(`Next URL (${waitTime} milliseconds wait time) is - ${nextURL}`);

                /*  */
                if (nextURLPriority === true) waitTime = 0;

                setTimeout(function () {
                    that.makeRequest(nextURL, matchingTemplate);
                }, waitTime);

            }
        }

        setTimeout(this.processNextInQueue.bind(this), 0);
    }

    /**
     * Makes a request to a specific URL and then applies the callback specified in its template.
     *
     * @param {String} url - An URL to be requested.
     * @param {Object} template - The corresponding template matching the URL provided.
     * @private
     */
    private makeRequest(url: string, template: TemplateWrapper<T>) {
        /* TODO: take care of other responses than 200. */

        let that: Scraper<T> = this;

        request.get(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                scraperDebug(`Got results for ${url}`);
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
    private determineInterval(template) {
        if (this.options.interval)
            return this.options.interval;
        else if (this.options.maxInterval)
            return Math.min(this.options.maxInterval, template.interval);
        else
            return template.interval;
    }
}

export default Scraper;