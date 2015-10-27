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