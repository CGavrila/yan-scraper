'use strict';

var expect = require('chai').expect;
var Scraper = require('../dist/index.js');
var sinon = require('sinon');
var request = require('request');

describe('Scraper', function() {

    var validTemplate = {
        name: 'default',
        callback: function() { return 0; }
    };

    beforeEach(function() {
        Scraper.destroyInstance();
    });

    it('should throw error if you try to instantiate it directly', function() {
        expect(function() {new Scraper()}).to.throw(Error);
    });

    it('shouldn\'t throw an error if trying to add valid template', function() {
        var scraper = Scraper.instance;
        expect(function() {scraper.addTemplate(validTemplate)}).to.not.throw(Error);
    });

    it('should throw error if trying to register template without name', function() {
        var scraper = Scraper.instance;
        var template = { callback: function () {} };
        expect(function() {scraper.addTemplate(template)}).to.throw(Error);
    });

    it('should throw error if trying to register template without callback', function() {
        var scraper = Scraper.instance;
        var template = { name: 'name' };
        expect(function() {scraper.addTemplate(template)}).to.throw(Error);
    });

    it('should throw error if trying to register template with same name', function() {
        var scraper = Scraper.instance;
        scraper.addTemplate(validTemplate);
        expect(function() {scraper.addTemplate(validTemplate)}).to.throw(Error);
    });

    it('should create a template when adding one', function() {
        var scraper = Scraper.instance;
        expect(Object.keys(scraper.getTemplates()).length).to.equal(0);
        scraper.addTemplate(validTemplate);
        expect(Object.keys(scraper.getTemplates()).length).to.equal(1);
    });

    it('can add single urls to the queue', function() {
        var scraper = Scraper.instance;
        expect(scraper.getQueue().length).to.equal(0);
        scraper.queue('whatever');
        expect(scraper.getQueue().length).to.equal(1);
        expect(scraper.getQueue().shift()).to.equal('whatever');
    });

    it('can add array of urls to the queue', function() {
        var scraper = Scraper.instance;
        expect(scraper.getQueue().length).to.equal(0);
        scraper.queue(['something', 'something else']);
        expect(scraper.getQueue().length).to.equal(2);
        expect(scraper.getQueue().shift()).to.equal('something');
        expect(scraper.getQueue().shift()).to.equal('something else');
    });

});
