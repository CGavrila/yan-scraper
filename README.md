Installaton
---

```javascript
npm install yan-scraper
```

Usage
---

```javascript
var Scraper = require('yan-scraper');

var scraper = Scraper.instance;
scraper.addTemplate({
    name: 'IMDB',
    matchesFormat: function(url) {
        return url.toLowerCase().indexOf('imdb.com') !== -1;
    },
    callback: function(url, body, $) {
        // $ is cheerio

        return { body: body, provider: 'IMDB' };
    }
});

scraper.addTemplate({
    name: 'Amazon',
    matchesFormat: function(url) {
        return url.toLowerCase().indexOf('amazon.co.uk') !== -1;
    },
    callback: function(url, body, $) {
        // $ is cheerio

        return { body: body, provider: 'Amazon' };
    }
});

scraper.on('result', function(result) {
  console.log(result);
});

scraper.on('unmatched', function(url) {
  console.log("Oops, there's an URL that couldn't be handled - " + url);
});

scraper.queue('http://www.imdb.com/title/tt0140688/'); // Will be handled by the IMDB template
scraper.queue('http://www.amazon.co.uk/gp/product/B00E0YFOKI/'); // Will be handled by the Amazon template
scraper.start();
```

#### Templates

Templates can be added via the `scraper.addTemplate()` method and need to have `name`, `matchesFormat` and `callback` as fields. You can add as many templates to the scraper as you want. The one that matches a specific pattern in the queue will have its callback applied.

```javascript
{
    name,          // String, unique identifier for the template
    matchesFormat, // Function with url as a parameter, return true if the url matches the template
    callback,      // Callback function with body and $ as paramters;
                   //    - body is the response retrieved from the link
                   //    - $ is cheerio
    interval       // Number, the amount of miliseconds to wait between requests for the same template

}
```

#### Priorities
Queueing URLs for the scraper to process can be done via the `scraper.queue(url [, priority=0])` function. Generally, this will mean that it will get processed depending on how many URLs are in the queue and what the interval defined in the `template` or `options` is.

However, the queue can be jumped by doing `scraper.queue(url, 1)`. This will result in the URL provided to be added in a separate queue which only keeps track of the priority URLs and will still respect the interval, but will overalap with the regular queue. The amortized average request interval between the regular and priority queues will be equal to the `interval`. 

**Example**:
```
var scraper = Scraper.instance;
scraper.setOptions({ interval: 2000 });
scraper.queue('http://www.example.com/1', 0); 
scraper.queue('http://www.example.com/2', 0);
scraper.queue('http://www.example.com/3', 1);
scraper.queue('http://www.example.com/4', 1);
scraper.queue('http://www.example.com/5', 0);
scraper.start();
```

will result in the links being ran approximately like:
```
     0ms - http://www.example.com/1, http://www.example.com/3
+ 2000ms - http://www.example.com/2, http://www.example.com/4
+ 4000ms - http://www.example.com/5
```

#### Options
Options can be passed by calling the `setOptions(options)` method on an instance or when doing `start()`. Currently supported options:
```javascript
{
    maxInterval,   // Number, the maximum amount of miliseconds to wait between requests for the same template,
                   // will cap any of the intervals defined for individual templates
    interval,      // Number, absolute amount of miliseconds to wait between requests for the same template,
                   // will completely override any interval defined for individual templates
}
```

Testing
---

Still needs some work, but the current tests can be ran by doing:
```javascript
npm test
```

[grunt-cli](https://github.com/gruntjs/grunt-cli) is a prerequisite.

License
---

MIT
