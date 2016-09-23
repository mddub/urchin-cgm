/* jshint node: true */
/* globals describe, it, before, beforeEach */
"use strict";

var expect = require('expect.js'),
  timekeeper = require('timekeeper');

var Data = require('../../src/js/data.js');

var defaultConstants = require('../../src/js/constants.json');

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
  global.localStorage = require('./make_mock_local_storage.js')();
});

var DEFAULT_MAX_SGVS = 48;
function defaultData() {
  return Data(defaultConstants, DEFAULT_MAX_SGVS);
}

describe('basals', function() {
  before(function() {
    // TODO: _profileBasalRateAtTime and _profileBasalsInWindow assume that the
    // basals from profile.json are in same timezone as the phone running Urchin
    process.env.TZ = 'America/Los_Angeles';
  });

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
      var d = defaultData();
      mockSingleTempBasal(d, "2015-12-03T14:12:25-08:00");
      timekeeper.freeze(new Date("2015-12-03T14:20:25-08:00"));

      return d.getActiveBasal({}).then(function(basal) {
        expect(basal.text).to.be('0u/h -0.65');
        expect(basal.recency).to.be(480);
      });
    });

    it('should compute recency correctly', function() {
      var d = defaultData();
      mockSingleTempBasal(d, "2015-12-03T14:12:25-08:00");
      timekeeper.freeze(new Date("2015-12-03T14:28:25-08:00"));

      return d.getActiveBasal({}).then(function(basal) {
        expect(basal.text).to.be('0u/h -0.65');
        expect(basal.recency).to.be(960);
      });
    });

    it('should report the profile basal rate if it is past the duration of the most recent temp basal', function() {
      var d = defaultData();
      mockSingleTempBasal(d, "2015-12-03T14:12:25-08:00");
      timekeeper.freeze(new Date("2015-12-03T14:50:25-08:00"));

      return d.getActiveBasal({}).then(function(basal) {
        expect(basal.text).to.be('0.65u/h');
        expect(basal.recency).to.be(0);
      });
    });

    it('should report the correct profile basal rate at any time', function() {
      var d = defaultData();
      mockSingleTempBasal(d, "2015-12-03T14:12:25-08:00");
      timekeeper.freeze(new Date("2015-12-03T20:50:25-08:00"));

      return d.getActiveBasal({}).then(function(basal) {
        expect(basal.text).to.be('0.55u/h');
        expect(basal.recency).to.be(0);
      });
    });
  });

  describe('getBasalHistory', function() {
    it('should report 24 hours of profile basals if no temps have occurred', function() {
      var d = defaultData();
      mockAPI(d, {
        'profile.json': PROFILE,
        'treatments.json': [],
      });

      timekeeper.freeze(new Date("2016-02-18T17:31:25-08:00"));

      return d.getBasalHistory({}).then(function(basals) {
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
      var d = defaultData();
      mockAPI(d, {
        'profile.json': PROFILE,
        'treatments.json': [
          tempBasal("2016-02-18T07:11:00-08:00", "30", "0.2"),
          tempBasal("2016-02-18T08:23:00-08:00", "19", "0"),
        ],
      });

      timekeeper.freeze(new Date("2016-02-18T17:31:25-08:00"));

      return d.getBasalHistory({}).then(function(basals) {
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
      var d = defaultData();
      mockAPI(d, {
        'profile.json': PROFILE,
        'treatments.json': [
          tempBasal("2016-02-18T07:52:00-08:00", "30", "0.9"),
          tempBasal("2016-02-18T08:02:00-08:00", "15", "0.1"),
        ],
      });

      timekeeper.freeze(new Date("2016-02-18T17:31:25-08:00"));

      return d.getBasalHistory({}).then(function(basals) {
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
      var d = defaultData();
      mockAPI(d, {
        'profile.json': PROFILE,
        'treatments.json': [
          tempBasal("2016-02-18T16:50:00-08:00", "30", "0.8"),
          tempBasal("2016-02-18T16:55:00-08:00", undefined, undefined),
        ],
      });

      timekeeper.freeze(new Date("2016-02-18T17:31:25-08:00"));

      return d.getBasalHistory({}).then(function(basals) {
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

  it('should report the rig battery level with recency', function() {
    var constants = {DEVICE_STATUS_RECENCY_THRESHOLD_SECONDS: 1800};
    var d = Data(constants);
    mockAPI(d, {'devicestatus.json': DEVICE_STATUS});
    timekeeper.freeze(new Date("2015-12-04T01:25:18.994Z"));

    return d.getRigBatteryLevel({}).then(function(battery) {
      expect(battery.text).to.eql('37%');
      expect(battery.recency).to.eql(1200);
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
    var d = defaultData();
    mockAPI(d, {
      'sgv.json': SGVS(1),
      'cal.json': CAL,
    });

    return d.getRawData({}).then(function(raw) {
      expect(raw.text).to.be('Cln 146 139');
    });
  });

  it('should show only the number of raw readings configured', function() {
    var d = defaultData();
    mockAPI(d, {
      'sgv.json': SGVS(3),
      'cal.json': CAL,
    });

    var config = {statusRawCount: 1};
    return d.getRawData(config).then(function(raw) {
      expect(raw.text).to.be('Med 139');
    });
  });

  it('should report raw sgvs in mmol when that preference is set, plus sensor noise on most recent sgv', function() {
    var d = defaultData();
    mockAPI(d, {
      'sgv.json': SGVS(2),
      'cal.json': CAL,
    });

    var config = {mmol: true};
    return d.getRawData(config).then(function(raw) {
      expect(raw.text).to.be('Lgt 8.1 7.7');
    });
  });
});

describe('getPebbleIOB', function() {
  it('should report IOB from the Nightscout /pebble endpoint', function() {
    var d = defaultData();
    mockAPI(d, {
      'pebble': {"bgs": [{"iob": 1.27}]}
    });

    return d.getPebbleIOB({}).then(function(iob) {
      expect(iob.text).to.be('1.3 u');
      expect(iob.recency).to.be(0);
    });
  });
});

describe('getPebbleIOBAndCOB', function() {
  it('should report IOB and COB from the Nightscout /pebble endpoint', function() {
    var d = defaultData();
    mockAPI(d, {
      // Pebble endpoint does weird stuff
      'pebble': {"bgs": [{"iob": "2.67", "cob": "28.63"}]}
    });
    return d.getPebbleIOBAndCOB({}).then(function(s) {
      expect(s.text).to.be('2.7 u  29 g');
      expect(s.recency).to.be(0);
    });
  });

  it('should report only IOB when COB is absent', function() {
    var d = defaultData();
    mockAPI(d, {
      'pebble': {"bgs": [{"iob": 1.83, "cob": "foo"}]}
    });
    return d.getPebbleIOBAndCOB({}).then(function(s) {
      expect(s.text).to.be('1.8 u');
      expect(s.recency).to.be(0);
    });
  });

  it('should report nothing when IOB and COB are both absent', function() {
    var d = defaultData();
    mockAPI(d, {
      'pebble': {"bgs": [{"iob": "", "cob": ""}]}
    });
    return d.getPebbleIOBAndCOB({}).then(function(s) {
      expect(s.text).to.be('-');
      expect(s.recency).to.be(undefined);
    });
  });
});

describe('getOpenAPSStatus', function() {
  function lastTwoOpenAPS() {
    return [
      {
        "openaps" : {
          "iob" : {
            "iob" : 1.08,
            "timestamp" : "2016-03-01T16:43:54.000Z"
          },
          // different from "suggested" below
          "suggested" : {
            "eventualBG" : 129,
             "timestamp" : "2016-03-01T16:43:58.000Z",
          },
          // identical to "enacted" below
          "enacted" : {
            "rate" : 1.95,
            "duration" : 30,
            "recieved" : true,
            "timestamp" : "2016-03-01T16:34:14.000Z",
          }
        },
        "device" : "device1",
        "created_at" : "2016-03-01T16:44:22.069Z",
      },
      {
        "openaps" : {
          "iob" : {
            "iob" : 0.938,
            "timestamp" : "2016-03-01T16:33:54.000Z",
          },
          "suggested" : {
            "eventualBG" : 165,
            "timestamp" : "2016-03-01T16:34:01.000Z",
          },
          "enacted" : {
            "rate" : 1.95,
            "duration" : 30,
            "recieved" : true,
            "timestamp" : "2016-03-01T16:34:14.000Z",
          }
        },
        "device" : "device1",
        "created_at" : "2016-03-01T16:34:39.692Z",
      }
    ];
  }

  function tempBasal() {
    return [{
      "duration" : 30,
      "absolute": 1.45,
      "created_at" : "2016-03-01T16:23:05Z",
    }];
  }

  describe('last "enacted" is stale but "suggested" is fresh', function() {
    var d;
    beforeEach(function() {
      d = defaultData();
      mockAPI(d, {
        'treatments': tempBasal(),
        'devicestatus': lastTwoOpenAPS(),
        'profile': [],
      });
      timekeeper.freeze(new Date('2016-03-01T16:48:00Z'));
    });

    it('should report the time since the last "suggested" if enacted is stale', function() {
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.recency).to.be(242);
      });
    });

    it('should report the time remaining in the last temp basal relative to now', function() {
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).to.contain('1.4x6');
      });
    });

    it('should not report a temp if the last temp basal is over', function() {
      timekeeper.freeze(new Date('2016-03-01T16:56:00Z'));
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).not.to.contain('1.4x');
      });
    });

    it('should report IOB', function() {
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).to.contain('1.1u');
      });
    });

    it('should not report eventual BG', function() {
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).not.to.contain('->129');
      });
    });
  });

  describe('last "enacted" is fresh', function() {
    var d;
    beforeEach(function() {
      var statuses = lastTwoOpenAPS();
      statuses[0]['openaps']['enacted'] = {
        'rate': 0.2,
        'duration': 30,
        'recieved': true,
        'timestamp': '2016-03-01T16:45:00Z',
      };
      d = defaultData();
      mockAPI(d, {
        'treatments': tempBasal(),
        'devicestatus': statuses,
        'profile': [],
      });
      timekeeper.freeze(new Date('2016-03-01T16:48:00Z'));
    });

    it('should report the time since the last "enacted"', function() {
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.recency).to.be(180);
      });
    });

    it('should report the time remaining in the enacted temp basal relative to now', function() {
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).to.contain('0.2x27');
      });
    });

    it('should not report a temp if the last enacted temp is over', function() {
      timekeeper.freeze(new Date('2016-03-01T17:20:00Z'));
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).not.to.contain('0.2x');
      });
    });

    it('should report IOB', function() {
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).to.contain('1.1u');
      });
    });

    it('should not report eventual BG', function() {
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).not.to.contain('->129');
      });
    });
  });

  it('should not report a basal rate if the enacted temp has duration 0', function() {
    var statuses = lastTwoOpenAPS();
    statuses[0]['openaps']['enacted'] = {
      'rate': 0,
      'duration': 0,
      'recieved': true,
      'timestamp': '2016-03-01T16:45:00Z',
    };
    var d = defaultData();
    mockAPI(d, {
      'treatments': tempBasal(),
      'devicestatus': statuses,
      'profile': [],
    });
    timekeeper.freeze(new Date('2016-03-01T16:48:00Z'));

    return d.getOpenAPSStatus({}).then(function(result) {
      expect(result.text).to.be('1.1u');
      expect(result.recency).to.be(180);
    });
  });

  it('should not report IOB if it is stale', function() {
    var statuses = lastTwoOpenAPS();
    statuses[0]['openaps']['iob'] = statuses[1]['openaps']['iob'];
    var d = defaultData();
    mockAPI(d, {
      'treatments': tempBasal(),
      'devicestatus': statuses,
      'profile': [],
    });
    timekeeper.freeze(new Date('2016-03-01T16:48:00Z'));

    return d.getOpenAPSStatus({}).then(function(result) {
      expect(result.text).not.to.contain('1.1u');
    });
  });

  it('should report eventualBG if configured', function() {
    var d = defaultData();
    mockAPI(d, {
      'treatments': tempBasal(),
      'devicestatus': lastTwoOpenAPS(),
      'profile': [],
    });
    timekeeper.freeze(new Date('2016-03-01T16:48:00Z'));

    return d.getOpenAPSStatus({statusOpenAPSEvBG: true}).then(function(result) {
      expect(result.text).to.contain('->129');
    });
  });

  it('should use the created_at time of the device status and report the time since last success if everything is stale', function() {
    var statuses = lastTwoOpenAPS();
    statuses[0]['openaps'] = statuses[1]['openaps'];
    statuses.push({
      'openaps': {
        'iob': {
          'iob': 3.14,
          "timestamp": '2016-03-01T16:29:00',
        },
        'suggested': {
          'timestamp': '2016-03-01T16:29:00'
        },
      },
      'device': statuses[0]['device'],
    });
    statuses.push({
      'openaps': {},
      'device': statuses[0]['device'],
    });
    var d = defaultData();
    mockAPI(d, {
      'treatments': tempBasal(),
      'devicestatus': statuses,
      'profile': [],
    });
    timekeeper.freeze(new Date('2016-03-01T16:58:00Z'));

    return d.getOpenAPSStatus({}).then(function(result) {
      expect(result.text).to.be('-- | (+15m) 3.1u');
      expect(result.recency).to.be(818);
    });
  });

  it('should not crash if no data', function() {
    var d = defaultData();
    mockAPI(d, {
      'treatments': [],
      'devicestatus': [],
      'profile': [],
    });
    return d.getOpenAPSStatus({}).then(function(result) {
      expect(result.text).to.be('-');
    });
  });

  describe('multiple devices', function() {
    function goodStatus(device, minAgo) {
      var dateString = new Date(Date.now() - minAgo * 60 * 1000);
      return {
        "openaps": {
          "iob": {
            "iob": 1.08,
            "timestamp": dateString,
          },
          "suggested": {
            "timestamp": dateString,
          }
        },
        "device": device,
        "created_at": dateString,
      };
    }
    function badStatus(device, minAgo) {
      var dateString = new Date(Date.now() - minAgo * 60 * 1000);
      return {
        "openaps": {},
        "device": device,
        "created_at": dateString,
      };
    }

    beforeEach(function() {
      timekeeper.freeze(new Date());
    });

    it('should report the last success even if a different device has failed since then', function() {
      var d = defaultData();
      mockAPI(d, {
        'treatments': [],
        'profile': [],
        'devicestatus': [
          badStatus('device1', 0),
          goodStatus('device2', 7),
          goodStatus('device2', 15),
        ],
      });
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).to.contain('1.1u');
        expect(result.recency).to.be(420);
      });
    });

    it('should report failure from the most recently successful device', function() {
      var d = defaultData();
      mockAPI(d, {
        'treatments': [],
        'profile': [],
        'devicestatus': [
          badStatus('device1', 0),
          badStatus('device2', 7),
          goodStatus('device2', 15),
          goodStatus('device2', 20),
        ],
      });
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).to.be('-- | (+8m) 1.1u');
        expect(result.recency).to.be(420);
      });
    });

    it('should report the most recent failure if there are no successes', function() {
      var d = defaultData();
      mockAPI(d, {
        'treatments': [],
        'profile': [],
        'devicestatus': [
          badStatus('device1', 1),
          badStatus('device2', 7),
          badStatus('device2', 15),
          badStatus('device1', 22),
        ],
      });
      return d.getOpenAPSStatus({}).then(function(result) {
        expect(result.text).to.be('--');
        expect(result.recency).to.be(60);
      });
    });
  });

});

describe('getCustomJsonUrl', function() {
  function testWith(data) {
    timekeeper.freeze(new Date());
    var d = defaultData();
    d.getURL = function() {
      return Promise.resolve(JSON.stringify(data));
    };
    return d.getCustomJsonUrl({statusJsonUrl: ''});
  }

  it('should show the content', function() {
    return testWith({content: 'hello'}).then(function(result) {
      expect(result.text).to.be('hello');
    });
  });

  it('should handle missing content', function() {
    return testWith({}).then(function(result) {
      expect(result.text).to.eql('-');
    });
  });

  it('should show recency for epoch time in ms', function() {
    return testWith({
      content: 'all clear',
      timestamp: Date.now() - 8 * 60 * 1000,
    }).then(function(result) {
      expect(result.text).to.be('all clear');
      expect(result.recency).to.be(480);
    });
  });

  it('should show recency for epoch time in seconds', function() {
    return testWith({
      content: 'all clear',
      timestamp: Math.floor(Date.now() / 1000 - 16 * 60),
    }).then(function(result) {
      expect(result.text).to.be('all clear');
      expect(result.recency).to.be(960);
    });
  });

  it('should handle an array', function() {
    return testWith([{content: 'in array'}]).then(function(result) {
      expect(result.text).to.be('in array');
    });
  });
});

describe('getMultiple', function() {
  var d;
  beforeEach(function() {
    d = defaultData();
    d.getRawData = function() {
      return Promise.resolve({text: 'raw data'});
    };
    d.getPebbleIOB = function() {
      return Promise.resolve({text: 'pebble iob', recency: 0});
    };
    d.getCustomJsonUrl = function() {
      return Promise.resolve({text: 'custom json', recency: 123});
    };
    d.getCustomText = function() {
      return Promise.reject(new Error());
    };
  });

  it('should get multiple status lines and join them with newlines', function() {
    return d.getStatusText({ statusContent: 'multiple',
      statusLine1: 'pebbleiob',
      statusLine2: 'rawdata',
      statusLine3: 'customjson',
    }).then(function(result) {
      expect(result.text).to.be([
        'pebble iob',
        'raw data',
        'custom json',
      ].join('\n'));
    });
  });

  it('should handle an error in one of the lines', function() {
    return d.getStatusText({ statusContent: 'multiple',
      statusLine1: 'customjson',
      statusLine2: 'customtext',
      statusLine3: 'rawdata',
    }).then(function(result) {
      expect(result.text).to.be([
        'custom json',
        '-',
        'raw data',
      ].join('\n'));
    });
  });

  it('should skip "none" lines', function() {
    return d.getStatusText({ statusContent: 'multiple',
      statusLine1: 'rawdata',
      statusLine2: 'none',
      statusLine3: 'pebbleiob',
    }).then(function(result) {
      expect(result.text).to.be([
        'raw data',
        'pebble iob',
      ].join('\n'));
    });
  });

  it('should use the recency from the first status line', function() {
    return d.getStatusText({ statusContent: 'multiple',
      statusLine1: 'customjson',
      statusLine2: 'pebbleiob',
      statusLine3: 'rawdata',
    }).then(function(result) {
      expect(result.recency).to.be(123);
    });
  });

  it('should use report missing recency if the first status line has no recency', function() {
    return d.getStatusText({ statusContent: 'multiple',
      statusLine1: 'rawdata',
      statusLine2: 'none',
      statusLine3: 'pebbleiob',
    }).then(function(result) {
      expect(result.recency).to.be(undefined);
    });
  });
});

describe('getShareSGVsDateDescending', function() {
  var config = {source: 'dexcom'};

  function mockDexcomAPI(data, sgvs) {
    data.postJSON = function(url) {
      urls.push(url);
      if (url.indexOf('ReadPublisherLatestGlucoseValues') !== -1) {
        return Promise.resolve(sgvs);
      } else {
        return Promise.resolve('fake-token');
      }
    };
  }

  var urls;
  var d;
  beforeEach(function() {
    urls = [];
    d = defaultData();
    mockDexcomAPI(d, []);
  });

  it('should request a token only once', function() {
    function afterFirstFetch() {
      expect(urls).to.have.length(2);
      return d.getSGVsDateDescending(config);
    }
    function afterSecondFetch() {
      expect(urls).to.have.length(3);
    }
    return d.getSGVsDateDescending(config).then(afterFirstFetch).then(afterSecondFetch);
  });

  it('should request a full history of SGVs when the cache is empty', function() {
    return d.getSGVsDateDescending(config).then(function() {
      expect(urls).to.have.length(2);
      expect(urls[urls.length - 1]).to.contain('maxCount=' + DEFAULT_MAX_SGVS);
    });
  });

  function expectSecondFetchCount(delayFromFirstSGV, expectedCount) {
    mockDexcomAPI(d, [{'Value': 108, 'Trend': 4, 'WT': '\/Date(1462420778000)\/'}]);
    function afterFirstFetch() {
      timekeeper.freeze(new Date(1462420778000 + delayFromFirstSGV));
      return d.getSGVsDateDescending(config);
    }
    function afterSecondFetch() {
      expect(urls[urls.length - 1]).to.contain('maxCount=' + expectedCount);
    }
    return d.getSGVsDateDescending(config).then(afterFirstFetch).then(afterSecondFetch);
  }

  it('should request 1 SGV when the last one is from less than 5 minutes ago', function() {
    return expectSecondFetchCount(30 * 1000, 1);
  });

  it('should request 2 SGVs when the last one is from 14:59 minutes ago', function() {
    return expectSecondFetchCount((14 * 60 + 59) * 1000, 2);
  });

  it('should request 3 SGVs when the last one is from 15:01 minutes ago', function() {
    return expectSecondFetchCount((15 * 60 + 1) * 1000, 3);
  });

  it('should request a full history of SGVs when the last one is from 20 hours ago', function() {
    return expectSecondFetchCount(20 * 60 * 60 * 1000, DEFAULT_MAX_SGVS);
  });

  it('should properly transform and dedupe data', function() {
    mockDexcomAPI(d, [
      {'Value': 108, 'Trend': 4, 'WT': '\/Date(1462420778000)\/'},
      {'Value': 102, 'Trend': 3, 'WT': '\/Date(1462420478000)\/'},
    ]);
    timekeeper.freeze(new Date(1462420778000 + 11 * 60 * 1000));
    function afterFirstFetch(sgvs) {
      expect(sgvs).to.have.length(2);
      expect(sgvs[0]).to.eql({sgv: 108, trend: 4, date: 1462420778000});
      expect(sgvs[1]).to.eql({sgv: 102, trend: 3, date: 1462420478000});
      mockDexcomAPI(d, [
        {'Value': 112, 'Trend': 4, 'WT': '\/Date(1462421078000)\/'},
        {'Value': 108, 'Trend': 4, 'WT': '\/Date(1462420778000)\/'},
      ]);
      return d.getSGVsDateDescending(config);
    }
    function afterSecondFetch(sgvs) {
      expect(urls[urls.length - 1]).to.contain('maxCount=2');
      expect(sgvs).to.have.length(3);
      mockDexcomAPI(d, [
        {'Value': 112, 'Trend': 4, 'WT': '\/Date(1462421078000)\/'},
      ]);
      return d.getSGVsDateDescending(config);
    }
    function afterThirdFetch(sgvs) {
      expect(urls[urls.length - 1]).to.contain('maxCount=1');
      expect(sgvs).to.have.length(3);
    }
    return d.getSGVsDateDescending(config)
      .then(afterFirstFetch)
      .then(afterSecondFetch)
      .then(afterThirdFetch);
  });
});
