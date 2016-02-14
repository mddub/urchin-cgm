/* jshint browser: true */
/* global module, Promise, Cache, debounce */

var Data = function(c) {
  var MAX_SGVS = c.SGV_FETCH_SECONDS / c.INTERVAL_SIZE_SECONDS + c.FETCH_EXTRA;
  var MAX_TEMP_BASALS = MAX_SGVS;
  var MAX_UPLOADER_BATTERIES = 1;
  var MAX_CALIBRATIONS = 1;
  var MAX_BOLUSES_PER_HOUR_AVERAGE = 6;
  var MAX_BOLUSES = c.SGV_FETCH_SECONDS / (60 * 60) * MAX_BOLUSES_PER_HOUR_AVERAGE;

  var sgvCache = new Cache('sgv', MAX_SGVS);
  var tempBasalCache = new Cache('tempBasal', MAX_TEMP_BASALS);
  var uploaderBatteryCache = new Cache('uploaderBattery', MAX_UPLOADER_BATTERIES);
  var calibrationCache = new Cache('calibration', MAX_CALIBRATIONS);
  var bolusCache = new Cache('bolus', MAX_BOLUSES);

  var d = {};

  d.clearCache = function() {
    sgvCache.clear();
    tempBasalCache.clear();
    uploaderBatteryCache.clear();
    calibrationCache.clear();
    bolusCache.clear();
  };

  d.getURL = function(url) {
    return new Promise(function(resolve, reject) {
      var received = false;
      var timedOut = false;

      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.onreadystatechange = function () {
        if (timedOut) {
          return;
        }
        if (xhr.readyState === 4) {
          received = true;
          if (xhr.status === 200) {
            resolve(xhr.responseText);
          } else {
            reject(new Error('Request failed, status ' + xhr.status + ': ' + url));
          }
        }
      };

      // In PebbleKit JS, specifying a timeout works only for synchronous XHR,
      // except on Android, where synchronous XHR doesn't work at all.
      // https://forums.getpebble.com/discussion/13224/problem-with-xmlhttprequest-timeout
      function onTimeout() {
        if (received) {
          return;
        }
        timedOut = true;
        xhr.abort();
        reject(new Error('Request timed out: ' + url));
      }

      // On iOS, PebbleKit JS will throw an error on send() for an invalid URL
      try {
        xhr.send();
        setTimeout(onTimeout, c.REQUEST_TIMEOUT);
      } catch (e) {
        reject(e);
      }
    });
  };

  d.getJSON = function(url) {
    return d.getURL(url).then(function(result) {
      return JSON.parse(result);
    });
  };

  d.getIOB = function(config) {
    return d.getJSON(config.nightscout_url + '/api/v1/entries.json?find[activeInsulin][$exists]=true&count=1').then(function(iobs) {
      if(iobs.length && Date.now() - iobs[0]['date'] <= c.IOB_RECENCY_THRESHOLD_SECONDS * 1000) {
        return iobs[0]['activeInsulin'].toFixed(1).toString() + ' u';
      } else {
        return '-';
      }
    });
  };

  d.getCustomText = function(config) {
    return Promise.resolve((config.statusText || '').substr(0, 255));
  };

  d.getCustomUrl = function(config) {
    return d.getURL(config.statusUrl).then(function(data) {
      return (data || '-').substr(0, 255);
    });
  };

  d.getRigBatteryLevel = function(config) {
    return d.getLastUploaderBattery(config).then(function(latest) {
      if (latest && latest.length && new Date(latest[0]['created_at']) >= new Date() - c.DEVICE_STATUS_RECENCY_THRESHOLD_SECONDS * 1000) {
        return latest[0]['uploaderBattery'] + '%';
      } else {
        return '-';
      }
    });
  };

  d.getRawData = function(config) {
    return Promise.all([
      d.getLastCalibration(config),
      d.getSGVsDateDescending(config),
    ]).then(function(results) {
      var calRecord = results[0],
        sgvRecords = results[1];

      if (calRecord && calRecord.length && sgvRecords && sgvRecords.length) {
        var noiseStr = c.DEXCOM_NOISE_STRINGS[sgvRecords[0]['noise']];

        // make shallow copy since this array is shared
        sgvRecords = sgvRecords.slice(0)
          .sort(function(a, b) {
            return a['date'] - b['date'];
          })
          .slice(sgvRecords.length - config.statusRawCount);

        var sgvString = sgvRecords.map(function(bg) {
          return _getRawMgdl(bg, calRecord[0]);
        }).map(function(mgdl) {
          return (config.mmol && !isNaN(mgdl)) ? (mgdl / 18.0).toFixed(1) : mgdl;
        }).join(' ');

        return (noiseStr ? noiseStr + ' ' : '') + sgvString;
      } else {
        return '-';
      }
    });
  };

  function _getRawMgdl(sgvRecord, calRecord) {
    if (sgvRecord.unfiltered) {
      if (sgvRecord.sgv && sgvRecord.sgv >= 40 && sgvRecord.sgv <= 400 && sgvRecord.filtered) {
        var ratio = calRecord.scale * (sgvRecord.filtered - calRecord.intercept) / calRecord.slope / sgvRecord.sgv;
        return Math.round(calRecord.scale * (sgvRecord.unfiltered - calRecord.intercept) / calRecord.slope / ratio);
      } else {
        return Math.round(calRecord.scale * (sgvRecord.unfiltered - calRecord.intercept) / calRecord.slope);
      }
    } else {
      return undefined;
    }
  }

  d.getRigBatteryAndRawData = function(config) {
    return Promise.all([
      d.getRigBatteryLevel(config),
      d.getRawData(config),
    ]).then(function(results) {
      return results.filter(
        function(v) { return v !== '-'; }
      ).join(' ') || '-';
    });
  };

  function _getCurrentProfileBasal(config) {
    // Nightscout API does not accept a document query for this endpoint, so no way to cache
    return d.getJSON(config.nightscout_url + '/api/v1/profile.json').then(function(profile) {
      // Handle different treatment API formats
      var basals;
      if (profile.length && profile[0]['basal']) {
        basals = profile[0]['basal'];
      } else if (profile.length && profile[0]['defaultProfile']) {
        basals = profile[0]['store'][profile[0]['defaultProfile']]['basal'];
      }

      if (basals && basals.length) {
        // Lexicographically compare current time with HH:MM basal start times
        // TODO: don't assume phone timezone and profile timezone are the same
        var now = new Date().toTimeString().substr(0, 5);
        var currentBasal = basals.filter(function(basal, i) {
          return (basal['time'] <= now && (i === basals.length - 1 || now < basals[i + 1]['time']));
        })[0];
        return parseFloat(currentBasal['value']);
      } else {
        return null;
      }
    });
  }

  function _getActiveTempBasal(config) {
    return d.getTempBasals(config).then(function(treatments) {
      if (treatments.length && treatments[0]['duration'] && Date.now() < new Date(treatments[0]['created_at']).getTime() + parseFloat(treatments[0]['duration']) * 60 * 1000) {
        var start = new Date(treatments[0]['created_at']);
        var rate;
        if (treatments[0]['percent'] && parseFloat(treatments[0]['percent']) === 0) {
          rate = 0;
        } else {
          rate = parseFloat(treatments[0]['absolute']);
        }
        return {start: start, rate: rate};
      } else {
        return null;
      }
    });
  }

  function _roundBasal(n) {
    if (n === 0) {
      return '0';
    } else if (parseFloat(n.toFixed(1)) === parseFloat(n.toFixed(2))) {
      return n.toFixed(1);
    } else {
      return n.toFixed(2);
    }
  }

  d.getActiveBasal = function(config) {
    // adapted from @audiefile: https://github.com/mddub/urchin-cgm/pull/1
    return Promise.all([
      _getCurrentProfileBasal(config),
      _getActiveTempBasal(config),
    ]).then(function(results) {
      var profileBasal = results[0],
        tempBasal = results[1];

      if (profileBasal === null && tempBasal === null) {
        return '-';
      } else if (tempBasal !== null) {
        var diff = tempBasal.rate - profileBasal;
        var minutesAgo = Math.round((new Date() - tempBasal.start) / (60 * 1000));
        return _roundBasal(tempBasal.rate) + 'u/h ' + (diff >= 0 ? '+' : '') + _roundBasal(diff) + ' (' + minutesAgo + ')';
      } else {
        return _roundBasal(profileBasal) + 'u/h';
      }
    });
  };

  d.getStatusText = function(config) {
    var defaultFn = d.getRigBatteryLevel;
    var fn = {
      'rigbattery': d.getRigBatteryLevel,
      'rawdata': d.getRawData,
      'rig-raw': d.getRigBatteryAndRawData,
      'basal': d.getActiveBasal,
      'pumpiob': d.getIOB,
      'customurl': d.getCustomUrl,
      'customtext': d.getCustomText,
    }[config.statusContent];
    return (fn || defaultFn)(config);
  };

  function getUsingCache(baseUrl, cache, dateKey) {
    var url = baseUrl;
    if (cache.entries.length) {
      url += '&find[' + dateKey + '][$gt]=' + encodeURIComponent(cache.entries[0][dateKey]);
    }
    return d.getJSON(url).then(function(newEntries) {
      return cache.update(newEntries);
    });
  }

  d.getSGVsDateDescending = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/entries/sgv.json?count=' + MAX_SGVS,
      sgvCache,
      'date'
    );
  });

  d.getTempBasals = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/treatments.json?find[eventType]=Temp+Basal&count=' + MAX_TEMP_BASALS,
      tempBasalCache,
      'timestamp'
    );
  });

  d.getLastUploaderBattery = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/devicestatus.json?find[uploaderBattery][$exists]=true&count=' + MAX_UPLOADER_BATTERIES,
      uploaderBatteryCache,
      'created_at'
    );
  });

  d.getLastCalibration = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/entries/cal.json?count=' + MAX_CALIBRATIONS,
      calibrationCache,
      'date'
    );
  });

  d.getBolusHistory = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/treatments.json?find[insulin][$exists]=true&count=' + MAX_BOLUSES,
      bolusCache,
      'created_at'
    );
  });

  return d;
};

if (typeof(module) !== 'undefined') {
  module.exports = Data;
}
