'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () {
    function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ('value' in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
        }
    }return function (Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
    };
})();

function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { 'default': obj };
}

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError('Cannot call a class as a function');
    }
}

var _collectionsDeque = require('collections/deque');

var _collectionsDeque2 = _interopRequireDefault(_collectionsDeque);

var _singleton = Symbol();

var Scraper = (function () {
    function Scraper(singletonToken) {
        _classCallCheck(this, Scraper);

        if (_singleton !== singletonToken) throw new Error('Scraper is a singleton class, cannot instantiate directly.');

        this.templates = {};
        this.queue = new _collectionsDeque2['default']();
    }

    _createClass(Scraper, [{
        key: 'addTemplate',
        value: function addTemplate(template) {
            if (!template.name) throw new Error('Template name is missing.');
            if (template.name in this.templates) throw new Error('Template already exists.');

            this.templates[template.name] = {};
        }
    }, {
        key: 'getTemplates',
        value: function getTemplates() {
            return this.templates;
        }
    }, {
        key: 'start',
        value: function start() {}
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
})();

exports['default'] = Scraper;
module.exports = exports['default'];
//# sourceMappingURL=index.js.map

//# sourceMappingURL=index-compiled.js.map