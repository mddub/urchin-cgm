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
    for(i = 0; i < c.SGV_FETCH_SECONDS; i += c.INTERVAL_SIZE_SECONDS) {
      graphed.push(noEntry);
      xs.push(endTime - i * 1000);
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
      if(min < c.INTERVAL_SIZE_SECONDS * 1000 && Math.abs(sgvs[i]['date'] - xs[xi]) < Math.abs(graphed[xi]['date'] - xs[xi])) {
        graphed[xi] = sgvs[i];
      }
    }

    var ys = graphed.map(function(entry) { return entry['sgv']; });

    return ys;
  };

  function _graphIntervals(endTime) {
    var out = [];
    for(var i = 0; i < c.SGV_FETCH_SECONDS; i += c.INTERVAL_SIZE_SECONDS) {
      out.push({
        start: endTime - 1000 * i - 1000 * c.INTERVAL_SIZE_SECONDS / 2,
        end: endTime - 1000 * i + 1000 * c.INTERVAL_SIZE_SECONDS / 2,
      });
    }
    return out;
  }

  f.bolusGraphArray = function(endTime, bolusHistory) {
    return _graphIntervals(endTime).map(function(interval) {
      var bolusInInterval = false;
      for(var j = 0; j < bolusHistory.length; j++) {
        var bolusTime = new Date(bolusHistory[j]['created_at']).getTime();
        if (interval.start < bolusTime && bolusTime < interval.end) {
          bolusInInterval = true;
        }
      }
      return bolusInInterval ? 1 : 0;
    });
  };

  f.basalRateArray = function(endTime, basalHistory) {
    return _graphIntervals(endTime).map(function(interval) {
      var rateTotals = {};
      basalHistory.forEach(function(basal, i) {
        if (i === basalHistory.length - 1) {
          return;
        }

        var next = basalHistory[i + 1];
        if (next.start <= interval.start || basal.start > interval.end) {
          return;
        }

        var duration;
        if (basal.start >= interval.start && next.start <= interval.end) {
          duration = next.start - basal.start;
        } else if (basal.start < interval.start && next.start <= interval.end) {
          duration = next.start - interval.start;
        } else if (basal.start >= interval.start && next.start > interval.end) {
          duration = interval.end - basal.start;
        } else {
          duration = interval.end - interval.start;
        }
        rateTotals[basal.absolute] = (basal.absolute in rateTotals ? rateTotals[basal.absolute] : 0) + duration;
      });

      if (Object.keys(rateTotals).length === 0) {
        return 0;
      } else {
        return parseFloat(
          Object.keys(rateTotals).reduce(function(acc, rate) {
            return rateTotals[rate] > rateTotals[acc] ? rate : acc;
          })
        );
      }
    });
  };

  function _rescale(arr, pixelHeight) {
    var max = Math.max.apply(Math, arr);
    return arr.map(function(x) {
      return Math.round(x / max * pixelHeight);
    });
  }

  f.basalGraphArray = function(endTime, basalHistory, config) {
    return _rescale(f.basalRateArray(endTime, basalHistory), config.basalHeight);
  };

  function _encodeBits(value, offset, bits) {
    return Math.min(value, Math.pow(2, bits) - 1) << offset;
  }

  f.graphExtraArray = function(boluses, basals) {
    var out = [];
    var bits;
    for(var i = 0; i < boluses.length; i++) {
      bits = 0;
      bits += _encodeBits(boluses[i], c.GRAPH_EXTRA_BOLUS_OFFSET, c.GRAPH_EXTRA_BOLUS_BITS);
      bits += _encodeBits(basals[i], c.GRAPH_EXTRA_BASAL_OFFSET, c.GRAPH_EXTRA_BASAL_BITS);
      out.push(bits);
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
      var seconds = (Date.now() - sgvs[0]['date']) / 1000;
      return Math.floor(seconds);
    }
  };

  return f;
};

if (typeof(module) !== 'undefined') {
  module.exports = Format;
}
