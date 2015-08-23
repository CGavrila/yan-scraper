'use strict';

var expect = require('chai').expect;
var Crawler = require('../dist/index.js');

describe('Scraper', function () {

    beforeEach(function () {
        Crawler.destroyInstance();
    });

    it('should throw error if you try to instantiate it directly', function () {
        expect(function () {
            new Crawler();
        }).to['throw'](Error);
    });

    it('should throw error if trying to register template without name', function () {
        var crawler = Crawler.instance;
        crawler.addTemplate({ name: 'whatever' });
        expect(function () {
            crawler.addTemplate({ name: 'whatever' });
        }).to['throw'](Error);
    });

    it('should throw error if trying to register template with same name', function () {
        var crawler = Crawler.instance;
        expect(function () {
            crawler.addTemplate({});
        }).to['throw'](Error);
    });

    it('shouldn\'t throw an error if trying to register template without name', function () {
        var crawler = Crawler.instance;
        expect(function () {
            crawler.addTemplate({ name: 'whatever' });
        }).to.not['throw'](Error);
    });

    it('should create a registered template', function () {
        var crawler = Crawler.instance;
        expect(Object.keys(crawler.getTemplates()).length).to.equal(0);
        crawler.addTemplate({ name: 'whatever' });
        expect(Object.keys(crawler.getTemplates()).length).to.equal(1);
    });
});

//# sourceMappingURL=test-compiled.js.map