/* jshint browser: true */
/* global exports */
/* exported Data */

var Data = function(c) {
  var d = {};

  // In PebbleKit JS, specifying a timeout works only for synchronous XHR,
  // except on Android, where synchronous XHR doesn't work at all.
  // https://forums.getpebble.com/discussion/13224/problem-with-xmlhttprequest-timeout
  d.getURL = function(url, callback) {
    var received = false;
    var timedOut = false;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (timedOut) {
        return;
      }
      if (xhr.readyState === 4) {
        received = true;
        if (xhr.status === 200) {
          callback(null, xhr.responseText);
        } else {
          callback(new Error('Request failed, status ' + xhr.status + ': ' + url));
        }
      }
    };

    function onTimeout() {
      if (received) {
        return;
      }
      timedOut = true;
      xhr.abort();
      callback(new Error('Request timed out: ' + url));
    }

    // On iOS, PebbleKit JS will throw an error on send() for an invalid URL
    try {
      xhr.send();
      setTimeout(onTimeout, c.REQUEST_TIMEOUT);
    } catch (e) {
      callback(e);
    }
  };

  d.getJSON = function(url, callback) {
    d.getURL(url, function(err, result) {
      if (err) {
        return callback(err);
      }
      try {
        callback(null, JSON.parse(result));
      } catch (e) {
        callback(e);
      }
    });
  };

  d.getIOB = function(config, callback) {
    d.getJSON(config.nightscout_url + '/api/v1/entries.json?find[activeInsulin][$exists]=true&count=1', function(err, iobs) {
      if (err) {
        return callback(err);
      }
      if(iobs.length && Date.now() - iobs[0]['date'] <= c.IOB_RECENCY_THRESHOLD_SECONDS * 1000) {
        var recency = Math.floor((Date.now() - iobs[0]['date']) / (60 * 1000));
        var iob = iobs[0]['activeInsulin'].toFixed(1).toString() + ' u (' + recency + ')';
        callback(null, iob);
      } else {
        callback(null, '-');
      }
    });
  };

  d.getCustomText = function(config, callback) {
    callback(null, config.statusText);
  };

  d.getCustomUrl = function(config, callback) {
    d.getURL(config.statusUrl, function(err, data) {
      if (err) {
        callback(err);
      } else {
        callback(null, (data || '-').substr(0, 255));
      }
    });
  };

  d.getRigBatteryLevel = function(config, callback) {
    d.getJSON(config.nightscout_url + '/api/v1/devicestatus.json?find[uploaderBattery][$exists]=true&count=1', function(err, deviceStatus) {
      if (err) {
        return callback(err);
      }
      if (deviceStatus && deviceStatus.length && new Date(deviceStatus[0]['created_at']) >= new Date() - c.DEVICE_STATUS_RECENCY_THRESHOLD_SECONDS * 1000) {
        callback(null, 'Rig ' + deviceStatus[0]['uploaderBattery'] + '%');
      } else {
        callback(null, '-');
      }
    });
  };

  d.getRawData = function(config, callback) {
    d.getJSON(config.nightscout_url + '/api/v1/entries/cal.json?count=1', function(err, calRecord) {
      if (err) {
        return callback(err);
      }
      if (calRecord && calRecord.length && calRecord.length > 0) {
        d.getJSON(config.nightscout_url + '/api/v1/entries/sgv.json?count=2', function(err, sgvRecords) {
          if (err) {
            return callback(err);
          }
          if (sgvRecords && sgvRecords.length) {
            callback(null, 'Raw ' + sgvRecords.map(function(bg) {
              return _getRawMgdl(bg, calRecord[0]);
            }).join(' '))
          } else {
            callback(null, '-');
          }
        });
      } else {
        callback(null, '-');
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

  function _getCurrentProfileBasal(config, callback) {
    d.getJSON(config.nightscout_url + '/api/v1/profile.json', function(err, profile) {
      if (err) {
        return callback(err);
      }

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
        callback(null, parseFloat(currentBasal['value']));
      } else {
        callback(null, null);
      }
    });
  }

  function _getActiveTempBasal(config, callback) {
    d.getJSON(config.nightscout_url + '/api/v1/treatments.json?find[eventType]=Temp+Basal&count=1', function(err, treatments) {
      if (err) {
        return callback(err);
      }
      if (treatments.length && treatments[0]['duration'] && Date.now() < new Date(treatments[0]['created_at']).getTime() + parseFloat(treatments[0]['duration']) * 60 * 1000) {
        var start = new Date(treatments[0]['created_at']);
        var rate;
        if (treatments[0]['percent'] && parseFloat(treatments[0]['percent']) === 0) {
          rate = 0;
        } else {
          rate = parseFloat(treatments[0]['absolute']);
        }
        callback(null, {start: start, rate: rate});
      } else {
        callback(null, null);
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

  d.getCurrentBasal = function(config, callback) {
    // adapted from @audiefile: https://github.com/mddub/nightscout-graph-pebble/pull/1
    _getCurrentProfileBasal(config, function(err, profileBasal) {
      if (err) {
        callback(err);
      }
      _getActiveTempBasal(config, function(err, tempBasal) {
        if (err) {
          callback(err);
        }
        if (profileBasal === null && tempBasal === null) {
          callback(null, '-');
        } else if (tempBasal !== null) {
          var diff = tempBasal.rate - profileBasal;
          var minutesAgo = Math.round((new Date() - tempBasal.start) / (60 * 1000));
          callback(null, _roundBasal(tempBasal.rate) + 'u/h ' + (diff >= 0 ? '+' : '') + _roundBasal(diff) + ' (' + minutesAgo + ')');
        } else {
          callback(null, _roundBasal(profileBasal) + 'u/h');
        }
      });
    });
  };

  d.getStatusText = function(config, callback) {
    var defaultFn = d.getIOB;
    var fn = {
      'pumpiob': d.getIOB,
      'basal': d.getCurrentBasal,
      'rigbattery': d.getRigBatteryLevel,
      'rawdata': d.getRawData,
      'customtext': d.getCustomText,
      'customurl': d.getCustomUrl,
    }[config.statusContent];
    (fn || defaultFn)(config, callback);
  };

  d.getSGVsDateDescending = function(config, callback) {
    var fetchStart = Date.now() - c.SGV_FETCH_SECONDS * 1000;
    var points = c.SGV_FETCH_SECONDS / c.INTERVAL_SIZE_SECONDS + c.FETCH_EXTRA;
    var url = config.nightscout_url + '/api/v1/entries/sgv.json?find[date][$gte]=' + fetchStart + '&count=' + points;
    d.getJSON(url, function(err, entries) {
      if (err) {
        return callback(err);
      }
      callback(null, entries.map(function(e) {
        e['date'] = e['date'] / 1000;
        return e;
      }));
    });
  };

  return d;
};

if (typeof(exports) !== 'undefined') {
  exports.Data = Data;
}
