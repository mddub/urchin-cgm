/* jshint browser: true */
/* global exports */
/* exported Data */

var Data = function(c) {
  var d = {};

  function _reviveItem(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return undefined;
    }
  }

  var sgvs = _reviveItem("sgvs") || [];
  var cal = _reviveItem("cal") || undefined;
  var treatments = _reviveItem("treatments") || [];
  var deviceStatus = _reviveItem("deviceStatus") || [];
  var profiles = _reviveItem("profiles") || [];

  var socket;

  function _storeCache() {
    localStorage.setItem("sgvs", JSON.stringify(sgvs));
    localStorage.setItem("cal", JSON.stringify(cal));
    localStorage.setItem("treatments", JSON.stringify(treatments));
    localStorage.setItem("deviceStatus", JSON.stringify(deviceStatus));
    localStorage.setItem("profiles", JSON.stringify(profiles));
  }

  d.setupWebSocket = function(config, callback) {
    var sortByMillsDesc = function(rec1, rec2) {
      return rec2["mills"] - rec1["mills"];
    };

    var millsToSeconds = function(rec) {
      rec["date"] = ~~(rec["mills"] / 1000);
      return rec;
    };

    if (!socket) {
      console.log("restart detected");
      socket = io(config.nightscout_url, {reconnect: true});
      socket.id = _reviveItem("socketId");
      socket.on('error', function (data) {
        console.log('Error:', JSON.stringify(data));
        callback(data, sgvs);
      });
      socket.on('dataUpdate', function (data) {
        console.log(Object.getOwnPropertyNames(socket.io));
        console.log("incoming data: "+ Object.getOwnPropertyNames(data));
        var sgvStart = Date.now() / 1000 - c.SGV_FETCH_SECONDS;
        if (data["sgvs"]) {
          console.log("incoming data with sgv count: " + data["sgvs"].length);
          sgvs = sgvs.concat(data["sgvs"]).map(millsToSeconds).filter(function (sgv) {
            return sgv["date"] >= sgvStart;
          }).map(function (sgv) {
            sgv["sgv"] = sgv["mgdl"];
            return sgv;
          }).sort(sortByMillsDesc);
        }
        if (data["cals"]) {
          cal = data["cals"]
              .map(millsToSeconds)
              .concat(cal)
              .sort(sortByMillsDesc)[0];
        }
        if (data["treatments"]) {
          treatments = treatments.concat(treatments, data["treatments"])
              .sort(sortByMillsDesc)
              .slice(0, 100);
        }
        if (data["devicestatus"]) {
          deviceStatus = data["devicestatus"];
        }
        if (data["profiles"]) {
          profiles = data["profiles"];
        }
        callback(null, sgvs);
        _storeCache();
      });
    }
    if (sgvs.length > 0)
      callback(null, sgvs);
  };

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
    // these don't appear to be getting passed via socket.io.
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
    if (deviceStatus) {
      callback(null, deviceStatus['uploaderBattery'] + '%');
    } else {
      callback(null, '-');
    }
  };

  d.getRawData = function(config, callback) {
    if (sgvs && sgvs.length >= 2 && cal) {
      callback(null, sgvs.slice(0, 3)
              .map(function(sgv) { return _getRawMgdl(sgv) })
              .map(function(mgdl) {
                return (config.mmol && !isNaN(mgdl)) ? (mgdl / 18.0).toFixed(1) : mgdl;
              }).reverse()
              .join(" ") + " " + deviceStatus['uploaderBattery'] + '%');
    } else {
      callback(null, '-');
    }
  };

  function _getRawMgdl(sgv) {
    if (sgv.unfiltered) {
      if (sgv.mgdl && sgv.mgdl >= 40 && sgv.mgdl <= 400 && sgv.filtered) {
        var ratio = cal.scale * (sgv.filtered - cal.intercept) / cal.slope / sgv.mgdl;
        return Math.round(cal.scale * (sgv.unfiltered - cal.intercept) / cal.slope / ratio);
      } else {
        return Math.round(cal.scale * (sgv.unfiltered - cal.intercept) / cal.slope);
      }
    } else {
      return undefined;
    }
  }

  d.getRigBatteryAndRawData = function(config, callback) {
    d.getRigBatteryLevel(config, function(err, battery) {
      if (err) {
        return callback(err);
      }
      d.getRawData(config, function(err, raw) {
        if (err) {
          return callback(err);
        }
        var line = [battery, raw].filter(function(v) { return v !== '-'; }).join(' ') || '-';
        callback(null, line);
      });
    });
  };

  function _getCurrentProfileBasal(config, callback) {
    // Handle different treatment API formats
    var basals;
    if (profiles.length && profiles[0]['basal']) {
      basals = profiles[0]['basal'];
    } else if (profiles.length && profiles[0]['defaultProfile']) {
      basals = profiles[0]['store'][profiles[0]['defaultProfile']]['basal'];
    }

    if (basals && basals.length) {
      // Lexicographically compare current time with HH:MM basal start times
      // TODO: don't assume phone timezone and profile timezone are the same
      var now = new Date().toTimeString().substr(0, 5);
      var currentBasal = basals.filter(function (basal, i) {
        return (basal['time'] <= now && (i === basals.length - 1 || now < basals[i + 1]['time']));
      })[0];

      callback(null, parseFloat(currentBasal['value']));
    } else {
      callback(null, null);
    }
  }

  function _getActiveTempBasal(config, callback) {
    var tempBasals = treatments.filter(function(treatment) {
      return treatment.eventType == "Temp Basal";
    });
    if (tempBasals.length && tempBasals[0]['duration'] && Date.now() < new Date(tempBasals[0]['mills']).getTime() + parseFloat(tempBasals[0]['duration']) * 60 * 1000) {
      var start = new Date(tempBasals[0]['mills']);
      var rate;
      if (tempBasals[0]['percent'] && parseFloat(tempBasals[0]['percent']) === 0) {
        rate = 0;
      } else {
        rate = parseFloat(tempBasals[0]['absolute']);
      }
      callback(null, {start: start, rate: rate});
    } else {
      callback(null, null);
    }
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

  d.getActiveBasal = function(config, callback) {
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
