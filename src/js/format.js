/* jshint browser: true */
/* global module */

var Format = function(c) {
  var f = {};

  f.sgvArray = function(endTime, sgvs) {
    var noEntry = {
      'date': Infinity,
      'sgv': 0
    };
    var i;

    var graphed = [];
    var xs = [];
    for(i = 0; i <= c.SGV_FETCH_SECONDS; i += c.INTERVAL_SIZE_SECONDS) {
      graphed.push(noEntry);
      xs.push(endTime - i);
    }

    for(i = 0; i < sgvs.length; i++) {
      var min = Infinity;
      var xi;
      // Don't graph missing sgvs or error codes
      if(sgvs[i]['sgv'] === undefined || sgvs[i]['sgv'] <= c.DEXCOM_ERROR_CODE_MAX) {
        continue;
      }
      // Find the x value closest to this sgv's date
      for(var j = 0; j < xs.length; j++) {
        if(Math.abs(sgvs[i]['date'] - xs[j]) < min) {
          min = Math.abs(sgvs[i]['date'] - xs[j]);
          xi = j;
        }
      }
      // Assign it if it's the closest sgv to that x
      if(min < c.INTERVAL_SIZE_SECONDS && Math.abs(sgvs[i]['date'] - xs[xi]) < Math.abs(graphed[xi]['date'] - xs[xi])) {
        graphed[xi] = sgvs[i];
      }
    }

    var ys = graphed.map(function(entry) { return entry['sgv']; });

    return ys;
  };

  f.bolusArray = function(endTime, bolusHistory) {
    var out = [];
    for(var i = 0; i <= c.SGV_FETCH_SECONDS; i += c.INTERVAL_SIZE_SECONDS) {
      var intervalStart = endTime - i - c.INTERVAL_SIZE_SECONDS / 2;
      var intervalEnd = endTime - i + c.INTERVAL_SIZE_SECONDS / 2;
      var bolusInInterval = false;
      for(var j = 0; j < bolusHistory.length; j++) {
        var bolusTime = new Date(bolusHistory[j]['created_at']).getTime() / 1000;
        if (intervalStart < bolusTime && bolusTime < intervalEnd) {
          bolusInInterval = true;
        }
      }
      out.push(bolusInInterval);
    }
    return out;
  };

  f.lastTrendNumber = function(sgvs) {
    if (sgvs.length === 0) {
      return 0;
    }

    var trend = sgvs[0]['trend'];
    if (!isNaN(parseInt(trend)) && trend >= 0 && trend <= 9) {
      return trend;
    } else if (sgvs[0]['direction'] !== undefined) {
      return c.NIGHTSCOUT_DIRECTION_TO_TREND[sgvs[0]['direction']] || 0;
    } else {
      return 0;
    }
  };

  f.lastSgv = function(sgvs) {
    return sgvs.length > 0 ? parseInt(sgvs[0]['sgv'], 10) : 0;
  };

  f.lastDelta = function(ys) {
    if (ys[1] === 0) {
      return c.NO_DELTA_VALUE;
    } else {
      return ys[0] - ys[1];
    }
  };

  f.recency = function(sgvs) {
    if (sgvs.length === 0) {
      // TODO
      return 999 * 60 * 60;
    } else {
      var seconds = Date.now() / 1000 - sgvs[0]['date'];
      return Math.floor(seconds);
    }
  };

  return f;
};

if (typeof(module) !== 'undefined') {
  module.exports = Format;
}
