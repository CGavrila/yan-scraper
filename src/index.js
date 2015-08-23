'use strict';

import Deque from 'collections/deque';
import * as request from 'request';
import * as _ from 'lodash';
import * as cheerio from 'cheerio';
var debug = require('debug')('Scraper');
var EventEmitter = require('events').EventEmitter;

let _singleton = Symbol();

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

    static destroyInstance() {
        this[_singleton] = null;
    }

    addTemplate(template) {
        if (!template.name) throw new Error('Template name is missing.');
        if (!template.callback) throw new Error('Template callback is missing.');
        if (template.name in this.templates) throw new Error('Template already exists.');

        this.templates[template.name] = template;
    }

    getTemplates() {
        return this.templates;
    }

    getQueue() {
        return this.deque;
    }

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

    start() {
        setTimeout(this._processNextInQueue.bind(this), 0);
    }

    _processNextInQueue() {
        let that = this;

        if (this.deque.length > 0) {
            let nextURL = this.deque.shift();
            let result;

            debug('Next URL is - ' + nextURL);

            /* Identify the proper callback to be used once the results come in. */
            let callback = _.find(this.templates, function(template) {
                return template.matchesFormat(nextURL);
            }).callback;

            request.get(nextURL, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    debug('Got results for ' + nextURL);
                    result = callback(body, cheerio.load(body));
                    that.emit('result', result);
                }
            });
        }

        setTimeout(this._processNextInQueue.bind(this), 100);
    }
}

export default Scraper;