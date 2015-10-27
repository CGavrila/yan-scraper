'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _collectionsDeque = require('collections/deque');

var _collectionsDeque2 = _interopRequireDefault(_collectionsDeque);

var _request = require('request');

var request = _interopRequireWildcard(_request);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _cheerio = require('cheerio');

var cheerio = _interopRequireWildcard(_cheerio);

var debug = require('debug')('Scraper');
var EventEmitter = require('events').EventEmitter;

var _singleton = Symbol();

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

var Scraper = (function (_EventEmitter) {
    _inherits(Scraper, _EventEmitter);

    function Scraper(singletonToken) {
        _classCallCheck(this, Scraper);

        _get(Object.getPrototypeOf(Scraper.prototype), 'constructor', this).call(this);
        if (_singleton !== singletonToken) throw new Error('Scraper is a singleton class, cannot instantiate directly.');

        this.templates = {};
        this.deque = new _collectionsDeque2['default']();
    }

    _createClass(Scraper, [{
        key: 'addTemplate',

        /**
         * Adds a template to the scraper.
         *
         * @param {object} template - The properties of the template, including name, matchesFormat, interval and callback.
         */
        value: function addTemplate(template) {
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
    }, {
        key: 'getTemplates',
        value: function getTemplates() {
            return this.templates;
        }

        /**
         * Retrieves the current queue.
         *
         * @returns {*} - The queue.
         */
    }, {
        key: 'getQueue',
        value: function getQueue() {
            return this.deque;
        }

        /**
         * Adds one or multiple URLs to the queue.
         *
         * @param urls {Array|String} - An array of URLs or a single URL as a string.
         */
    }, {
        key: 'queue',
        value: function queue(urls) {
            var _this = this;

            if (_lodash2['default'].isArray(urls)) {
                urls.forEach(function (url) {
                    _this.deque.push(url);
                });
            } else {
                this.deque.push(urls);
            }
        }

        /**
         * Retrives the waiting times (in ms) for all templates.
         */
    }, {
        key: 'getWaitTimes',
        value: function getWaitTimes() {
            var waitTimes = {};
            _lodash2['default'].forEach(this.templates, function (template) {
                var waitTime = template.lastUsed - Date.now() + template.interval || 0; // 0 for when the template was not used
                waitTimes[template.name] = Math.max(waitTime, 0);
            });
            return waitTimes;
        }

        /**
         * Starts the whole process of looping through the queue.
         */
    }, {
        key: 'start',
        value: function start() {
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
    }, {
        key: '_processNextInQueue',
        value: function _processNextInQueue() {
            var _this2 = this;

            var that = this;

            if (this.deque.length > 0) {
                (function () {
                    var nextURL = _this2.deque.shift();

                    /* Identify the proper callback to be used once the results come in. */
                    var matchingTemplate = _lodash2['default'].find(_this2.templates, function (template) {
                        return template.matchesFormat(nextURL);
                    });

                    if (matchingTemplate === undefined) {
                        that.emit('unmatched', nextURL);
                    } else {

                        var interval = matchingTemplate.interval;

                        /*
                         * Computing how much time is needed until the next request for this specific
                         * tuple (url, template) should happen.
                         *
                         * If the last request happened less time ago than the specified interval or didn't
                         * happen at all until now, then run it straight away.
                         *
                         * Otherwise, set it to run after a while, so that it matches the minimum interval specified.
                         */
                        var waitTime = undefined;
                        if (matchingTemplate.lastUsed) {
                            // basically it it's undefined
                            if (matchingTemplate.lastUsed + interval < Date.now()) waitTime = 0;else waitTime = matchingTemplate.lastUsed + interval - Date.now();
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
                })();
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
    }, {
        key: '_makeRequest',
        value: function _makeRequest(url, template) {
            /* TODO: take care of other responses than 200. */

            var that = this;

            request.get(url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    debug('Got results for ' + url);
                    var result = template.callback(url, body, cheerio.load(body));
                    that.emit('result', _lodash2['default'].merge(result, { url: url, template: template }));
                }
            });
        }
    }], [{
        key: 'destroyInstance',

        /**
         * Used to destroy the current instance of the class (it's a Singleton).
         * Particularly useful for testing.
         */
        value: function destroyInstance() {
            this[_singleton] = null;
        }
    }, {
        key: 'instance',
        get: function get() {
            if (!this[_singleton]) this[_singleton] = new Scraper(_singleton);

            return this[_singleton];
        }
    }]);

    return Scraper;
})(EventEmitter);

exports['default'] = Scraper;
module.exports = exports['default'];
//# sourceMappingURL=index.js.map
