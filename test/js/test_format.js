/* jshint node: true */
/* globals describe, it */
"use strict";

var expect = require('expect.js'),
  fs = require('fs');

var Format = require('../../src/js/format.js');

var constants = JSON.parse(fs.readFileSync('../../src/js/constants.json', 'utf8'));

describe('format', function() {
  var format = Format(constants);

  function expectZeroesForGraph(arr) {
    expect(arr.length).to.be(constants.SGV_FETCH_SECONDS / constants.INTERVAL_SIZE_SECONDS);
    arr.forEach(function(y) {
      expect(y).to.be(0);
    });
  }

  describe('sgvArray', function() {
    it('should return an array of zeroes when there is no data', function() {
      expectZeroesForGraph(
        format.sgvArray(Date.now(), [])
      );
    });
  });

  describe('basalRateArray', function() {
    it('should return the basal rate which was active for the most time during each 5-minute graph interval', function() {
      var basals = [
        {start: new Date("2016-02-18T16:30:00-08:00").getTime(), absolute: 0.2},
        {start: new Date("2016-02-18T17:03:00-08:00").getTime(), absolute: 0.3},

        {start: new Date("2016-02-18T17:25:00-08:00").getTime(), absolute: 0.4},
        {start: new Date("2016-02-18T17:27:31-08:00").getTime(), absolute: 0.5},
        {start: new Date("2016-02-18T17:30:00-08:00").getTime(), absolute: 0.6},

        {start: new Date("2016-02-18T17:45:00-08:00").getTime(), absolute: 0.7},
        {start: new Date("2016-02-18T17:47:29-08:00").getTime(), absolute: 0.8},
        {start: new Date("2016-02-18T17:50:00-08:00").getTime()},
      ];

      // the interval around this endTime is 17:45:00 to 17:50:00
      var endTime = new Date("2016-02-18T17:47:30-08:00").getTime();

      var arr = format.basalRateArray(endTime, basals);
      expect(arr.slice(0, 20)).to.eql(
        [0.8, 0.6, 0.6, 0.6, 0.4, 0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0, 0, 0]
      );
    });

    it('should return an array of zeroes when there is no data', function() {
      expectZeroesForGraph(
        format.basalRateArray(Date.now(), [])
      );
    });
  });
});
