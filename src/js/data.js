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
  var profileCache;

  var d = {};

  d.clearCache = function() {
    sgvCache.clear();
    tempBasalCache.clear();
    uploaderBatteryCache.clear();
    calibrationCache.clear();
    bolusCache.clear();
    profileCache = undefined;
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

  d.getCarePortalIOB = function(config) {
    return d.getJSON(config.nightscout_url + '/pebble').then(function(pebbleData) {
      if(pebbleData['bgs'] !== undefined && pebbleData['bgs'].length && !isNaN(parseFloat(pebbleData['bgs'][0]['iob']))) {
        return parseFloat(pebbleData['bgs'][0]['iob']).toFixed(1).toString() + ' u';
      } else {
        return '-';
      }
    });
  };

  d.getCustomText = function(config) {
    return Promise.resolve((config.statusText || '').substr(0, 255));
  };

  d.getCustomUrl = function(config) {
    // XXX: No combination of request headers seems capable of achieving this on all platforms
    var cacheBustUrl = config.statusUrl + (config.statusUrl.indexOf('?') !== -1 ? '&' : '?') + '_=' + Date.now();
    return d.getURL(cacheBustUrl).then(function(data) {
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

  function _basalsFromProfile(profile) {
    if (profile.length && profile[0]['basal']) {
      return profile[0]['basal'];
    } else if (profile.length && profile[0]['defaultProfile']) {
      return profile[0]['store'][profile[0]['defaultProfile']]['basal'];
    } else {
      return [];
    }
  }

  function _profileBasalRateAtTime(basals, mills) {
    // Lexicographically compare current time with HH:MM basal start times
    // TODO: don't assume phone timezone and profile timezone are the same
    var nowHHMM = new Date(mills).toTimeString().substr(0, 5);
    var basal = basals.filter(function(basal, i) {
      return (basal['time'] <= nowHHMM && (i === basals.length - 1 || nowHHMM < basals[i + 1]['time']));
    })[0];
    return parseFloat(basal['value']);
  }

  function _getCurrentProfileBasal(config) {
    // Nightscout API does not accept a document query for this endpoint, so no way to cache
    return d.getProfile(config).then(function(profile) {
      var basals = _basalsFromProfile(profile);
      if (basals.length) {
        return _profileBasalRateAtTime(basals, Date.now());
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
      'careportaliob': d.getCarePortalIOB,
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
      'created_at'
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

  d.getProfile = function(config) {
    // Data from the profile.json endpoint has no notion of "modified at", so
    // we can't use a date to invalidate a cache as above. But the profile
    // changes so infrequently that we can simply request it once per app load.
    // (If the user updates their profile, they should restart the watchface.)
    if (profileCache === undefined) {
      profileCache = d.getJSON(config.nightscout_url + '/api/v1/profile.json');
    }
    return profileCache;
  };

  function _hhmmAfter(hhmm, mills) {
    var date = new Date(mills);
    var withSameDate = new Date(
      1900 + date.getYear(),
      date.getMonth(),
      date.getDate(),
      parseInt(hhmm.substr(0, 2), 10),
      parseInt(hhmm.substr(3, 5), 10)
    ).getTime();
    return withSameDate > date ? withSameDate : withSameDate + 24 * 60 * 60 * 1000;
  }

  function _profileBasalsInWindow(basals, start, end) {
    if (basals.length === 0) {
      return [];
    }

    var i;
    var out = [];
    function nextProfileBasal() {
      i = (i + 1) % basals.length;
      var lastStart = out[out.length - 1].start;
      return {
        start: _hhmmAfter(basals[i]['time'], lastStart),
        absolute: parseFloat(basals[i]['value']),
      };
    }

    i = 0;
    var startHHMM = new Date(start).toTimeString().substr(0, 5);
    while(i < basals.length - 1 && basals[i + 1]['time'] <= startHHMM) {
      i++;
    }
    out.push({
      start: start,
      absolute: parseFloat(basals[i]['value']),
    });

    var next = nextProfileBasal();
    while(next.start < end) {
      out.push(next);
      next = nextProfileBasal();
    }

    return out;
  }

  d.getBasalHistory = function(config) {
    return Promise.all([
      d.getProfile(config),
      d.getTempBasals(config),
    ]).then(function(results) {
      var profileBasals = _basalsFromProfile(results[0]);
      var temps = results[1].map(function(temp) {
        return {
          start: new Date(temp['created_at']).getTime(),
          duration: temp['duration'] === undefined ? 0 : parseInt(temp['duration'], 10) * 60 * 1000,
          absolute: temp['absolute'] === undefined ? 0 : parseFloat(temp['absolute']),
        };
      }).concat([
        {
          start: Date.now() - 24 * 60 * 60 * 1000,
          duration: 0,
        },
        {
          start: Date.now(),
          duration: 0,
        },
      ]).sort(function(a, b) {
        return a.start - b.start;
      });

      var out = [];
      temps.forEach(function(temp) {
        var last = out[out.length - 1];
        if (last && last.duration !== undefined && last.start + last.duration < temp.start) {
          Array.prototype.push.apply(out, _profileBasalsInWindow(profileBasals, last.start + last.duration, temp.start));
        }
        out.push(temp);
      });
      return out;
    });
  };

  return d;
};

if (typeof(module) !== 'undefined') {
  module.exports = Data;
}
