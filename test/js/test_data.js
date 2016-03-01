/* jshint node: true */
/* globals describe, it, beforeEach */
"use strict";

var expect = require('expect.js'),
  fs = require('fs'),
  timekeeper = require('timekeeper');

var Data = require('../../src/js/data.js');

var defaultConstants = JSON.parse(fs.readFileSync('../../src/js/constants.json', 'utf8'));
var config = {};

function mockAPI(data, urlToData) {
  data.getJSON = function(url) {
    return new Promise(function(resolve) {
      Object.keys(urlToData).forEach(function(key) {
        if (url.indexOf(key) !== -1) {
          resolve(urlToData[key]);
        }
      });
    });
  };
}

beforeEach(function() {
  // XXX need browserify and real `require`s
  global.Cache = require('../../src/js/cache.js');
  global.debounce = require('../../src/js/debounce.js');

  global.localStorage = require('./make_mock_local_storage.js')();
});

describe('basals', function() {
  var PROFILE = [{
    "created_at" : "2015-10-22T17:58-0700",
    "startDate" : "2015-10-22T17:57-0700",
    "timezone" : "America/Los_Angeles",
    "basal" : [
      {
        "time" : "00:00",
        "value" : "0.45",
      },
      {
        "time" : "08:00",
        "value" : "0.65",
      },
      {
        "time" : "18:00",
        "value" : "0.55",
      }
    ]
  }];

  function tempBasal(timestamp, duration, absolute) {
    return {
      "eventType": "Temp Basal",
      "created_at": timestamp,
      "duration": duration,
      "absolute": absolute,
    };
  }

  function mockSingleTempBasal(data, tempBasalTimestamp) {
    mockAPI(data, {
      'profile.json': PROFILE,
      'treatments.json': [tempBasal(tempBasalTimestamp, "30", "0")],
    });
  }

  describe('getActiveBasal', function() {
    it('should report a temp basal with the difference from current basal and recency', function() {
      var d = Data(defaultConstants);
      mockSingleTempBasal(d, "2015-12-03T14:12:25-08:00");
      timekeeper.freeze(new Date("2015-12-03T14:20:25-08:00"));

      return d.getActiveBasal(config).then(function(basal) {
        expect(basal).to.be('0u/h -0.65 (8)');
      });
    });

    it('should compute recency correctly', function() {
      var d = Data(defaultConstants);
      mockSingleTempBasal(d, "2015-12-03T14:12:25-08:00");
      timekeeper.freeze(new Date("2015-12-03T14:28:25-08:00"));

      return d.getActiveBasal(config).then(function(basal) {
        expect(basal).to.be('0u/h -0.65 (16)');
      });
    });

    it('should report the profile basal rate if it is past the duration of the most recent temp basal', function() {
      var d = Data(defaultConstants);
      mockSingleTempBasal(d, "2015-12-03T14:12:25-08:00");
      timekeeper.freeze(new Date("2015-12-03T14:50:25-08:00"));

      return d.getActiveBasal(config).then(function(basal) {
        expect(basal).to.be('0.65u/h');
      });
    });

    it('should report the correct profile basal rate at any time', function() {
      var d = Data(defaultConstants);
      mockSingleTempBasal(d, "2015-12-03T14:12:25-08:00");
      timekeeper.freeze(new Date("2015-12-03T20:50:25-08:00"));

      return d.getActiveBasal(config).then(function(basal) {
        expect(basal).to.be('0.55u/h');
      });
    });
  });

  describe('getBasalHistory', function() {
    it('should report 24 hours of profile basals if no temps have occurred', function() {
      var d = Data(defaultConstants);
      mockAPI(d, {
        'profile.json': PROFILE,
        'treatments.json': [],
      });

      timekeeper.freeze(new Date("2016-02-18T17:31:25-08:00"));

      return d.getBasalHistory(config).then(function(basals) {
        expect(basals.length).to.be(6);
        [
          {start: Date.now() - 24 * 60 * 60 * 1000, duration: 0},
          {start: Date.now() - 24 * 60 * 60 * 1000, absolute: 0.65},
          {start: new Date("2016-02-17T18:00:00-08:00").getTime(), absolute: 0.55},
          {start: new Date("2016-02-18T00:00:00-08:00").getTime(), absolute: 0.45},
          {start: new Date("2016-02-18T08:00:00-08:00").getTime(), absolute: 0.65},
          {start: Date.now(), duration: 0},
        ].forEach(function(basal, i) {
          expect(basals[i]).to.eql(basal);
        });
      });
    });

    it('should interpose profile basals if there is a gap between two temp basals', function() {
      var d = Data(defaultConstants);
      mockAPI(d, {
        'profile.json': PROFILE,
        'treatments.json': [
          tempBasal("2016-02-18T07:11:00-08:00", "30", "0.2"),
          tempBasal("2016-02-18T08:23:00-08:00", "19", "0"),
        ],
      });

      timekeeper.freeze(new Date("2016-02-18T17:31:25-08:00"));

      return d.getBasalHistory(config).then(function(basals) {
        expect(basals.length).to.be(10);
        [
          {start: Date.now() - 24 * 60 * 60 * 1000, duration: 0},
          {start: Date.now() - 24 * 60 * 60 * 1000, absolute: 0.65},
          {start: new Date("2016-02-17T18:00:00-08:00").getTime(), absolute: 0.55},
          {start: new Date("2016-02-18T00:00:00-08:00").getTime(), absolute: 0.45},
          {start: new Date("2016-02-18T07:11:00-08:00").getTime(), absolute: 0.2, duration: 30 * 60 * 1000},
          {start: new Date("2016-02-18T07:41:00-08:00").getTime(), absolute: 0.45},
          {start: new Date("2016-02-18T08:00:00-08:00").getTime(), absolute: 0.65},
          {start: new Date("2016-02-18T08:23:00-08:00").getTime(), absolute: 0, duration: 19 * 60 * 1000},
          {start: new Date("2016-02-18T08:42:00-08:00").getTime(), absolute: 0.65},
          {start: Date.now(), duration: 0},
        ].forEach(function(basal, i) {
          expect(basals[i]).to.eql(basal);
        });
      });
    });

    it('should not interpose profile basals if two temp basals overlap', function() {
      var d = Data(defaultConstants);
      mockAPI(d, {
        'profile.json': PROFILE,
        'treatments.json': [
          tempBasal("2016-02-18T07:52:00-08:00", "30", "0.9"),
          tempBasal("2016-02-18T08:02:00-08:00", "15", "0.1"),
        ],
      });

      timekeeper.freeze(new Date("2016-02-18T17:31:25-08:00"));

      return d.getBasalHistory(config).then(function(basals) {
        expect(basals.length).to.be(8);
        [
          {start: Date.now() - 24 * 60 * 60 * 1000, duration: 0},
          {start: Date.now() - 24 * 60 * 60 * 1000, absolute: 0.65},
          {start: new Date("2016-02-17T18:00:00-08:00").getTime(), absolute: 0.55},
          {start: new Date("2016-02-18T00:00:00-08:00").getTime(), absolute: 0.45},
          {start: new Date("2016-02-18T07:52:00-08:00").getTime(), absolute: 0.9, duration: 30 * 60 * 1000},
          {start: new Date("2016-02-18T08:02:00-08:00").getTime(), absolute: 0.1, duration: 15 * 60 * 1000},
          {start: new Date("2016-02-18T08:17:00-08:00").getTime(), absolute: 0.65},
          {start: Date.now(), duration: 0},
        ].forEach(function(basal, i) {
          expect(basals[i]).to.eql(basal);
        });
      });
    });

    it('should treat an empty "Temp Basal" treatment recorded by Nightscout Care Portal as having duration 0', function() {
      var d = Data(defaultConstants);
      mockAPI(d, {
        'profile.json': PROFILE,
        'treatments.json': [
          tempBasal("2016-02-18T16:50:00-08:00", "30", "0.8"),
          tempBasal("2016-02-18T16:55:00-08:00", undefined, undefined),
        ],
      });

      timekeeper.freeze(new Date("2016-02-18T17:31:25-08:00"));

      return d.getBasalHistory(config).then(function(basals) {
        expect(basals.length).to.be(9);
        [
          {start: Date.now() - 24 * 60 * 60 * 1000, duration: 0},
          {start: Date.now() - 24 * 60 * 60 * 1000, absolute: 0.65},
          {start: new Date("2016-02-17T18:00:00-08:00").getTime(), absolute: 0.55},
          {start: new Date("2016-02-18T00:00:00-08:00").getTime(), absolute: 0.45},
          {start: new Date("2016-02-18T08:00:00-08:00").getTime(), absolute: 0.65},
          {start: new Date("2016-02-18T16:50:00-08:00").getTime(), absolute: 0.8, duration: 30 * 60 * 1000},
          {start: new Date("2016-02-18T16:55:00-08:00").getTime(), absolute: 0, duration: 0},
          {start: new Date("2016-02-18T16:55:00-08:00").getTime(), absolute: 0.65},
          {start: Date.now(), duration: 0},
        ].forEach(function(basal, i) {
          expect(basals[i]).to.eql(basal);
        });
      });
    });
  });
});

describe('getRigBatteryLevel', function() {
  var DEVICE_STATUS = [{
    "uploaderBattery": 37,
    "created_at": "2015-12-04T01:05:18.994Z"
  }];

  it('should report the rig battery level if it is recent enough', function() {
    var constants = {DEVICE_STATUS_RECENCY_THRESHOLD_SECONDS: 1800};
    var d = Data(constants);
    mockAPI(d, {'devicestatus.json': DEVICE_STATUS});
    timekeeper.freeze(new Date("2015-12-04T01:25:18.994Z"));

    return d.getRigBatteryLevel(config).then(function(battery) {
      expect(battery).to.be('37%');
    });
  });

  it('should not report the rig battery level if it is stale', function() {
    var constants = {DEVICE_STATUS_RECENCY_THRESHOLD_SECONDS: 60};
    var d = Data(constants);
    mockAPI(d, {'devicestatus.json': DEVICE_STATUS});
    timekeeper.freeze(new Date("2015-12-04T01:25:18.994Z"));

    return d.getRigBatteryLevel(config).then(function(battery) {
      expect(battery).to.be('-');
    });
  });
});

describe('getRawData', function() {
  function SGVS(lastNoise) {
    return [
      {
        "date" : 1449535203000,
        "dateString" : "2015-12-08T00:40:03+00:00",
        "direction" : "FortyFiveDown",
        "filtered" : 180352,
        "noise" : lastNoise,
        "sgv" : 146,
        "type" : "sgv",
        "unfiltered" : 172672
      },
      {
        "date" : 1449534904000,
        "dateString" : "2015-12-08T00:35:04+00:00",
        "direction" : "FortyFiveDown",
        "filtered" : 186240,
        "noise" : 1,
        "sgv" : 153,
        "type" : "sgv",
        "unfiltered" : 178528
      }
    ];
  }

  var CAL = [{
    "date" : 1449309612000,
    "dateString" : "2015-12-05T10:00:12+00:00",
    "intercept" : 27370.3970783194,
    "scale" : 1,
    "slope" : 786.670463685642,
    "type" : "cal"
  }];

  it('should report raw sgvs in ascending date order, plus sensor noise on most recent sgv', function() {
    var d = Data(defaultConstants);
    mockAPI(d, {
      'sgv.json': SGVS(1),
      'cal.json': CAL,
    });

    return d.getRawData(config).then(function(raw) {
      expect(raw).to.be('Cln 146 139');
    });
  });

  it('should show only the number of raw readings configured', function() {
    var d = Data(defaultConstants);
    mockAPI(d, {
      'sgv.json': SGVS(3),
      'cal.json': CAL,
    });

    var config = {statusRawCount: 1};
    return d.getRawData(config).then(function(raw) {
      expect(raw).to.be('Med 139');
    });
  });

  it('should report raw sgvs in mmol when that preference is set, plus sensor noise on most recent sgv', function() {
    var d = Data(defaultConstants);
    mockAPI(d, {
      'sgv.json': SGVS(2),
      'cal.json': CAL,
    });

    var config = {mmol: true};
    return d.getRawData(config).then(function(raw) {
      expect(raw).to.be('Lgt 8.1 7.7');
    });
  });
});

describe('getCarePortalIOB', function() {
  it('should report IOB from the Nightscout /pebble endpoint', function() {
    var PEBBLE_DATA = {
      "bgs": [{"iob": 1.27}]
    };
    var d = Data(defaultConstants);
    mockAPI(d, {
      'pebble': PEBBLE_DATA
    });

    return d.getCarePortalIOB({}).then(function(iob) {
      expect(iob).to.be('1.3 u');
    });
  });
});
