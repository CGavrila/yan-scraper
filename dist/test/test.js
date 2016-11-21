'use strict';
var chai_1 = require('chai');
var index_1 = require('../index');
var nock = require('nock');
describe('Scraper', function () {
    var validTemplate = {
        name: 'default',
        interval: 2000,
        matchesFormat: function (url) {
            return url.toLowerCase().indexOf('example.com') !== -1;
        },
        callback: function (url, body, $) { return {}; }
    };
    before(function () {
        nock('http://www.example.com').get('/').reply(200, {
            message: "- Nock nock! " +
                "- Who's there? " +
                "- Nock. " +
                "- Nock who? " +
                "- Nock nock! " +
                "- Who's there? "
        });
    });
    beforeEach(function () {
        index_1.default.destroyInstance();
    });
    it('should throw error if you try to instantiate it directly', function () {
        chai_1.expect(function () { new index_1.default(); }).to.throw(Error);
    });
    it('shouldn\'t throw an error if trying to add valid template', function () {
        var scraper = index_1.default.getInstance();
        chai_1.expect(function () { scraper.addTemplate(validTemplate); }).to.not.throw(Error);
    });
    it('should throw error if trying to register template without name', function () {
        var scraper = index_1.default.getInstance();
        var template = { callback: function () { } };
        chai_1.expect(function () { scraper.addTemplate(template); }).to.throw(Error);
    });
    it('should throw error if trying to register template without callback', function () {
        var scraper = index_1.default.getInstance();
        var template = { name: 'name' };
        chai_1.expect(function () { scraper.addTemplate(template); }).to.throw(Error);
    });
    it('should throw error if trying to register template with same name', function () {
        var scraper = index_1.default.getInstance();
        scraper.addTemplate(validTemplate);
        chai_1.expect(function () { scraper.addTemplate(validTemplate); }).to.throw(Error);
    });
    it('should create a template when adding one', function () {
        var scraper = index_1.default.getInstance();
        chai_1.expect(Object.keys(scraper.getTemplates()).length).to.equal(0);
        scraper.addTemplate(validTemplate);
        chai_1.expect(Object.keys(scraper.getTemplates()).length).to.equal(1);
    });
    it('can add single urls to the queue', function () {
        var scraper = index_1.default.getInstance();
        chai_1.expect(scraper.getQueue().length).to.equal(0);
        scraper.queue('whatever');
        chai_1.expect(scraper.getQueue().length).to.equal(1);
        chai_1.expect(scraper.getQueue().shift().url).to.equal('whatever');
    });
    it('can add array of urls to the queue', function () {
        var scraper = index_1.default.getInstance();
        chai_1.expect(scraper.getQueue().length).to.equal(0);
        scraper.queue(['something', 'something else']);
        chai_1.expect(scraper.getQueue().length).to.equal(2);
        chai_1.expect(scraper.getQueue().shift().url).to.equal('something');
        chai_1.expect(scraper.getQueue().shift().url).to.equal('something else');
    });
    it('can handle URLs in the queue not matching any template', function (done) {
        var scraper = index_1.default.getInstance();
        var URLs = ['shouldnt match the matchFormat rules'];
        scraper.queue(URLs);
        scraper.start();
        scraper.on('unmatched', function () {
            done();
        });
    });
    it('provides the URL as the first argument of the callback', function (done) {
        var scraper = index_1.default.getInstance();
        var URL = 'http://www.example.com';
        scraper.queue(URL);
        scraper.start();
        scraper.on('unmatched', function (url, body, $) {
            chai_1.expect(url).to.equal(URL);
            done();
        });
    });
    describe('getWaitTimes()', function () {
        it('it returns wait times', function () {
            var scraper = index_1.default.getInstance();
            scraper.addTemplate(validTemplate);
            var times = 5;
            for (var i = 0; i < times; i++)
                scraper.addToQueue('http://www.example.com');
            chai_1.expect(scraper.getWaitTimes()).to.have.property(validTemplate.name);
        });
        it('returns proper wait times', function (done) {
            var scraper = index_1.default.getInstance();
            scraper.addTemplate(validTemplate);
            chai_1.expect(scraper.getWaitTimes()[validTemplate.name]).to.equal(0);
            var times = 5;
            for (var i = 0; i < times; i++)
                scraper.queue('http://www.example.com');
            scraper.start();
            scraper.on('result', function () {
                setTimeout(function () {
                    chai_1.expect(scraper.getWaitTimes()[validTemplate.name]).to.be.above(scraper.getTemplates()[validTemplate.name].interval * (times - 1));
                    done();
                }, 100);
            });
        });
    });
    describe('options', function () {
        it('it uses options.interval if set', function (done) {
            var scraper = index_1.default.getInstance();
            scraper.setOptions({
                interval: 10000
            });
            scraper.addTemplate(validTemplate);
            var times = 5;
            for (var i = 0; i < times; i++)
                scraper.queue('http://www.example.com');
            scraper.start();
            scraper.on('result', function () {
                setTimeout(function () {
                    chai_1.expect(scraper.getWaitTimes()[validTemplate.name]).to.be.above(30000);
                    done();
                }, 100);
            });
        });
        it('it uses options.maxInterval if set', function (done) {
            var scraper = index_1.default.getInstance();
            scraper.setOptions({
                maxInterval: 10000
            });
            scraper.addTemplate(validTemplate);
            var times = 5;
            for (var i = 0; i < times; i++)
                scraper.queue('http://www.example.com');
            scraper.start();
            scraper.on('result', function () {
                setTimeout(function () {
                    chai_1.expect(scraper.getWaitTimes()[validTemplate.name]).to.be.above(30000);
                    done();
                }, 100);
            });
        });
        it('it uses options.interval over options.maxInterval if both are set', function () {
            var scraper = index_1.default.getInstance();
            scraper.setOptions({
                interval: 10000,
                maxInterval: 100
            });
            scraper.addTemplate(validTemplate);
            var times = 5;
            for (var i = 0; i < times; i++)
                scraper.queue('http://www.example.com');
            scraper.start();
            scraper.on('result', function (done) {
                setTimeout(function () {
                    chai_1.expect(scraper.getWaitTimes()[validTemplate.name]).to.be.above(30000);
                    done();
                }, 100);
            });
        });
    });
    describe('priorities', function () {
        var priorityTime;
        nock('http://www.example.com').get('/').reply(200, {});
        nock('http://www.example.com').get('/priority').reply(200, function () {
            priorityTime = Date.now();
        });
        it('it uses options.interval if set', function (done) {
            this.timeout(30000);
            var initTime = Date.now();
            var scraper = index_1.default.getInstance();
            scraper.setOptions({
                interval: 2000
            });
            scraper.addTemplate(validTemplate);
            for (var i = 0; i < 100; i++)
                scraper.queue('http://www.example.com');
            for (var i = 0; i < 3; i++)
                scraper.queue('http://www.example.com/priority', 1);
            scraper.start();
            scraper.on('result', function () {
                setTimeout(function () {
                    chai_1.expect(priorityTime - initTime).to.be.below(500);
                    done();
                }, 100);
            });
        });
    });
});
//# sourceMappingURL=test.js.map