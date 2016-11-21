'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Immutable = require('immutable');
var request = require('request');
var _ = require('lodash');
var cheerio = require('cheerio');
var debug = require('debug');
var events_1 = require('events');
var scraperDebug = debug('yan-scraper');
var Scraper = (function (_super) {
    __extends(Scraper, _super);
    function Scraper(options) {
        _super.call(this);
        this.templates = {};
        this.queue = Immutable.List();
        this.options = options;
    }
    Scraper.prototype.addTemplate = function (template) {
        var templateWrapper = template;
        if (!templateWrapper.name)
            throw new Error('Template name is missing.');
        if (!templateWrapper.callback)
            throw new Error('Template callback is missing.');
        if (!templateWrapper.matchesFormat)
            throw new Error('Template matchesFormat property is missing.');
        if (templateWrapper.name in this.templates)
            throw new Error('Template already exists.');
        if (!('interval' in templateWrapper))
            templateWrapper.interval = 0;
        this.templates[templateWrapper.name] = templateWrapper;
    };
    Scraper.prototype.getTemplates = function () {
        return this.templates;
    };
    Scraper.prototype.setOptions = function (options) {
        this.options = options;
    };
    Scraper.prototype.getOptions = function () {
        return this.options;
    };
    Scraper.prototype.getQueue = function () {
        return this.queue;
    };
    Scraper.prototype.addToQueue = function (url, priority) {
        var _this = this;
        if (!priority)
            priority = false;
        if (_.isArray(url)) {
            _.forEach(url, function (url) {
                _this.queue.push({ url: url, priority: priority });
            });
        }
        else {
            this.queue.push({ url: url, priority: priority });
        }
    };
    Scraper.prototype.getWaitTimes = function () {
        var that = this;
        var waitTimes = {};
        _.forEach(this.templates, function (template) {
            var waitTime = (template.lastUsed - Date.now() + that.determineInterval(template)) || 0;
            waitTimes[template.name] = Math.max(waitTime, 0);
        });
        return waitTimes;
    };
    Scraper.prototype.start = function (options) {
        if (options)
            this.options = options;
        setTimeout(this.processNextInQueue.bind(this), 0);
    };
    Scraper.prototype.processNextInQueue = function () {
        var that = this;
        if (this.queue.size > 0) {
            var queueEntry = this.queue.first();
            this.queue = this.queue.shift();
            var nextURL_1 = queueEntry.url;
            var nextURLPriority = queueEntry.priority;
            var matchingTemplate_1 = _.find(this.templates, function (template) {
                return template.matchesFormat(nextURL_1);
            });
            if (!matchingTemplate_1) {
                that.emit('unmatched', nextURL_1);
            }
            else {
                var interval = that.determineInterval(matchingTemplate_1);
                var waitTime = void 0;
                if (nextURLPriority === false && matchingTemplate_1.lastUsed) {
                    if ((matchingTemplate_1.lastUsed + interval) < Date.now())
                        waitTime = 0;
                    else
                        waitTime = (matchingTemplate_1.lastUsed + interval) - Date.now();
                }
                else if (nextURLPriority === true && matchingTemplate_1.lastUsedPriority) {
                    if ((matchingTemplate_1.lastUsedPriority + interval) < Date.now())
                        waitTime = 0;
                    else
                        waitTime = (matchingTemplate_1.lastUsedPriority + interval) - Date.now();
                }
                else {
                    waitTime = 0;
                }
                scraperDebug(matchingTemplate_1.name + ' - ' + matchingTemplate_1.lastUsed + ' - ' + waitTime);
                matchingTemplate_1.lastUsed = Date.now() + waitTime;
                if (nextURLPriority === false)
                    matchingTemplate_1.lastUsedPriority = Date.now() + waitTime;
                scraperDebug("Next URL (" + waitTime + " milliseconds wait time) is - " + nextURL_1);
                if (nextURLPriority === true)
                    waitTime = 0;
                setTimeout(function () {
                    that.makeRequest(nextURL_1, matchingTemplate_1);
                }, waitTime);
            }
        }
        setTimeout(this.processNextInQueue.bind(this), 0);
    };
    Scraper.prototype.makeRequest = function (url, template) {
        var that = this;
        request.get(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                scraperDebug("Got results for " + url);
                var result = template.callback(url, body, cheerio.load(body));
                that.emit('result', _.merge(result, { url: url, template: template }));
            }
        });
    };
    Scraper.prototype.determineInterval = function (template) {
        if (this.options.interval)
            return this.options.interval;
        else if (this.options.maxInterval)
            return Math.min(this.options.maxInterval, template.interval);
        else
            return template.interval;
    };
    return Scraper;
}(events_1.EventEmitter));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Scraper;
//# sourceMappingURL=index.js.map