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

var _ = _interopRequireWildcard(_lodash);

var _cheerio = require('cheerio');

var cheerio = _interopRequireWildcard(_cheerio);

var debug = require('debug')('Scraper');
var EventEmitter = require('events').EventEmitter;

var _singleton = Symbol();

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
        value: function addTemplate(template) {
            if (!template.name) throw new Error('Template name is missing.');
            if (!template.callback) throw new Error('Template callback is missing.');
            if (template.name in this.templates) throw new Error('Template already exists.');

            this.templates[template.name] = template;
        }
    }, {
        key: 'getTemplates',
        value: function getTemplates() {
            return this.templates;
        }
    }, {
        key: 'getQueue',
        value: function getQueue() {
            return this.deque;
        }
    }, {
        key: 'queue',
        value: function queue(urls) {
            var _this = this;

            if (_.isArray(urls)) {
                urls.forEach(function (url) {
                    _this.deque.push(url);
                });
            } else {
                this.deque.push(urls);
            }
        }
    }, {
        key: 'start',
        value: function start() {
            setTimeout(this._processNextInQueue.bind(this), 0);
        }
    }, {
        key: '_processNextInQueue',
        value: function _processNextInQueue() {
            var _this2 = this;

            var that = this;

            if (this.deque.length > 0) {
                (function () {
                    var nextURL = _this2.deque.shift();
                    var result = undefined;

                    debug('Next URL is - ' + nextURL);

                    /* Identify the proper callback to be used once the results come in. */
                    var callback = _.find(_this2.templates, function (template) {
                        return template.matchesFormat(nextURL);
                    }).callback;

                    request.get(nextURL, function (error, response, body) {
                        if (!error && response.statusCode == 200) {
                            debug('Got results for ' + nextURL);
                            result = callback(body, cheerio.load(body));

                            that.emit('result', result);
                        }
                    });
                })();
            }

            setTimeout(this._processNextInQueue.bind(this), 100);
        }
    }], [{
        key: 'destroyInstance',
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
