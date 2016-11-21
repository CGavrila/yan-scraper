/// <reference path="../../typings/index.d.ts" />

'use strict';

import { expect } from 'chai';
import Scraper from '../index';
import * as nock from 'nock';
import { Template } from "../index";

interface Result {}

describe('Scraper', function() {

    let validTemplate: Template<Result> = {
        name: 'default',
        interval: 2000,
        matchesFormat: (url: string): boolean =>  {
            return url.toLowerCase().indexOf('example.com') !== -1;
        },
        callback: (url: string, body: any, $: CheerioStatic): Result => { return {}; }
    };

    /* Both a before hook and a lesson on recursion */
    before(function() {
        nock('http://www.example.com').get('/').reply(200, {
            message:
                "- Nock nock! " +
                "- Who's there? " +
                "- Nock. " +
                "- Nock who? " +
                "- Nock nock! " +
                "- Who's there? "
        });
    });

    beforeEach(function() {
        Scraper.destroyInstance();
    });

    it('should throw error if you try to instantiate it directly', function() {
        expect(function() {new Scraper()}).to.throw(Error);
    });

    it('shouldn\'t throw an error if trying to add valid template', function() {
        let scraper = Scraper.getInstance();
        expect(function() {scraper.addTemplate(validTemplate)}).to.not.throw(Error);
    });

    it('should throw error if trying to register template without name', function() {
        let scraper = Scraper.getInstance();
        let template = { callback: function () {} };
        expect(function() {scraper.addTemplate(template)}).to.throw(Error);
    });

    it('should throw error if trying to register template without callback', function() {
        let scraper = Scraper.getInstance();
        let template = { name: 'name' };
        expect(function() {scraper.addTemplate(template)}).to.throw(Error);
    });

    it('should throw error if trying to register template with same name', function() {
        let scraper = Scraper.getInstance();
        scraper.addTemplate(validTemplate);
        expect(function() {scraper.addTemplate(validTemplate)}).to.throw(Error);
    });

    it('should create a template when adding one', function() {
        let scraper = Scraper.getInstance();
        expect(Object.keys(scraper.getTemplates()).length).to.equal(0);
        scraper.addTemplate(validTemplate);
        expect(Object.keys(scraper.getTemplates()).length).to.equal(1);
    });

    it('can add single urls to the queue', function() {
        let scraper = Scraper.getInstance();
        expect(scraper.getQueue().length).to.equal(0);
        scraper.queue('whatever');
        expect(scraper.getQueue().length).to.equal(1);
        expect(scraper.getQueue().shift().url).to.equal('whatever');
    });

    it('can add array of urls to the queue', function() {
        let scraper = Scraper.getInstance();
        expect(scraper.getQueue().length).to.equal(0);
        scraper.queue(['something', 'something else']);
        expect(scraper.getQueue().length).to.equal(2);
        expect(scraper.getQueue().shift().url).to.equal('something');
        expect(scraper.getQueue().shift().url).to.equal('something else');
    });

    it('can handle URLs in the queue not matching any template', function(done) {
        let scraper = Scraper.getInstance();

        let URLs = ['shouldnt match the matchFormat rules'];
        scraper.queue(URLs);

        scraper.start();

        scraper.on('unmatched', function() {
           done();
        });
    });

    it('provides the URL as the first argument of the callback', function(done) {
        let scraper = Scraper.getInstance();

        let URL = 'http://www.example.com';
        scraper.queue(URL);

        scraper.start();

        scraper.on('unmatched', function(url, body, $) {
            expect(url).to.equal(URL);
            done();
        });
    });

    describe('getWaitTimes()', function() {

        it('it returns wait times', function() {
            let scraper = Scraper.getInstance();

            scraper.addTemplate(validTemplate);

            let times = 5;
            for (let i=0; i<times; i++)
                scraper.addToQueue('http://www.example.com');

            expect(scraper.getWaitTimes()).to.have.property(validTemplate.name);
        });

        /* Slightly flaky test since it's relying on setTimeout */
        it('returns proper wait times', function(done) {

            let scraper = Scraper.getInstance();

            scraper.addTemplate(validTemplate);

            expect(scraper.getWaitTimes()[validTemplate.name]).to.equal(0);

            let times = 5;
            for (let i=0; i<times; i++)
                scraper.queue('http://www.example.com');

            scraper.start();
            scraper.on('result', function() {
                setTimeout(function () {
                    expect(scraper.getWaitTimes()[validTemplate.name]).to.be.above(scraper.getTemplates()[validTemplate.name].interval * (times - 1));
                    done();
                }, 100);
            });

        });

    });

    describe('options', function() {

        it('it uses options.interval if set', function(done) {
            let scraper = Scraper.getInstance();
            scraper.setOptions({
                interval: 10000
            });

            scraper.addTemplate(validTemplate);

            let times = 5;
            for (let i=0; i<times; i++)
                scraper.queue('http://www.example.com');

            scraper.start();
            scraper.on('result', function() {
                setTimeout(function () {
                    expect(scraper.getWaitTimes()[validTemplate.name]).to.be.above(30000);
                    done();
                }, 100);
            });
        });

        it('it uses options.maxInterval if set', function(done) {
            let scraper = Scraper.getInstance();
            scraper.setOptions({
                maxInterval: 10000
            });

            scraper.addTemplate(validTemplate);

            let times = 5;
            for (let i=0; i<times; i++)
                scraper.queue('http://www.example.com');

            scraper.start();
            scraper.on('result', function() {
                setTimeout(function () {
                    expect(scraper.getWaitTimes()[validTemplate.name]).to.be.above(30000);
                    done();
                }, 100);
            });
        });

        it('it uses options.interval over options.maxInterval if both are set', function() {
            let scraper = Scraper.getInstance();
            scraper.setOptions({
                interval: 10000,
                maxInterval: 100
            });

            scraper.addTemplate(validTemplate);

            let times = 5;
            for (let i=0; i<times; i++)
                scraper.queue('http://www.example.com');

            scraper.start();
            scraper.on('result', function(done) {
                setTimeout(function () {
                    expect(scraper.getWaitTimes()[validTemplate.name]).to.be.above(30000);
                    done();
                }, 100);
            });
        });

    });

    describe('priorities', function() {

        let priorityTime;

        nock('http://www.example.com').get('/').reply(200, {});
        nock('http://www.example.com').get('/priority').reply(200, function() {
            priorityTime = Date.now();
        });

        it('it uses options.interval if set', function(done) {
            this.timeout(30000);

            let initTime = Date.now();

            let scraper = Scraper.getInstance();
            scraper.setOptions({
                interval: 2000
            });

            scraper.addTemplate(validTemplate);

            for (let i=0; i<100; i++)
                scraper.queue('http://www.example.com');

            for (let i=0; i<3; i++)
                scraper.queue('http://www.example.com/priority', 1);

            scraper.start();
            scraper.on('result', function() {
                setTimeout(function () {
                    expect(priorityTime - initTime).to.be.below(500);
                    done();
                }, 100);
            });
        });

    });

});
