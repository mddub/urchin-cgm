/* jshint browser: true */
/* global console, Pebble */
/* exported main */

function main(c) {

  var config;

  function mergeConfig(config, defaults) {
    var out = {};
    Object.keys(defaults).forEach(function(key) {
      out[key] = defaults[key];
    });
    Object.keys(config).forEach(function(key) {
      out[key] = config[key];
    });
    return out;
  }

  function sgvDataError(e) {
    console.log(e);
    sendMessage({msgType: c.MSG_TYPE_ERROR});
  }

  // In PebbleKit JS, specifying a timeout works only for synchronous XHR,
  // except on Android, where synchronous XHR doesn't work at all.
  // https://forums.getpebble.com/discussion/13224/problem-with-xmlhttprequest-timeout
  function getURL(url, callback) {
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
  }

  function getJSON(url, callback) {
    getURL(url, function(err, result) {
      if (err) {
        return callback(err);
      }
      try {
        callback(null, JSON.parse(result));
      } catch (e) {
        callback(e);
      }
    });
  }

  function getIOB(config, callback) {
    getJSON(config.nightscout_url + '/api/v1/entries.json?find[activeInsulin][$exists]=true&count=1', function(err, iobs) {
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
  }

  function getCustomUrl(config, callback) {
    getURL(config.statusUrl, callback);
  }

  function _getCurrentProfileBasal(config, callback) {
    getJSON(config.nightscout_url + '/api/v1/profile.json', function(err, profile) {
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
    getJSON(config.nightscout_url + '/api/v1/treatments?find[eventType]=Temp+Basal&count=1', function(err, treatments) {
      if (err) {
        return callback(err);
      }
      if (treatments.length && treatments[0]['duration'] && Date.now() < new Date(treatments[0]['created_at']).getTime() + parseFloat(treatments[0]['duration']) * 60 * 1000) {
        if (treatments[0]['percent'] && parseFloat(treatments[0]['percent']) === 0) {
          callback(null, 0);
        } else {
          callback(null, parseFloat(treatments[0]['absolute']));
        }
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

  function getCurrentBasal(config, callback) {
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
          var diff = tempBasal - profileBasal;
          callback(null, _roundBasal(tempBasal) + 'u/h (' + (diff >= 0 ? '+' : '') + _roundBasal(diff) + ')');
        } else {
          callback(null, _roundBasal(profileBasal) + 'u/h');
        }
      });
    });
  }

  function getStatusText(config, callback) {
    var defaultFn = getIOB;
    var fn = {
      'pumpiob': getIOB,
      'basal': getCurrentBasal,
      'customurl': getCustomUrl,
    }[config.statusContent];
    (fn || defaultFn)(config, callback);
  }

  function getSGVsDateDescending(config, callback) {
    var fetchStart = Date.now() - c.SGV_FETCH_SECONDS * 1000;
    var points = c.SGV_FETCH_SECONDS / c.INTERVAL_SIZE_SECONDS + c.FETCH_EXTRA;
    var url = config.nightscout_url + '/api/v1/entries/sgv.json?find[date][$gte]=' + fetchStart + '&count=' + points;
    getJSON(url, function(err, entries) {
      if (err) {
        return callback(err);
      }
      callback(null, entries.map(function(e) {
        e['date'] = e['date'] / 1000;
        return e;
      }));
    });
  }

  function graphArray(sgvs) {
    var endTime = sgvs.length > 0 ? sgvs[0]['date'] : new Date();
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
  }

  function lastSgv(sgvs) {
    return sgvs.length > 0 ? parseInt(sgvs[0]['sgv'], 10) : 0;
  }

  function directionToTrend(direction) {
    return {
      'NONE': 0,
      'DoubleUp': 1,
      'SingleUp': 2,
      'FortyFiveUp': 3,
      'Flat': 4,
      'FortyFiveDown': 5,
      'SingleDown': 6,
      'DoubleDown': 7,
      'NOT COMPUTABLE': 8,
      'RATE OUT OF RANGE': 9,
    }[direction] || 0;
  }

  function lastTrendNumber(sgvs) {
    if (sgvs.length === 0) {
      return 0;
    }

    var trend = sgvs[0]['trend'];
    if (trend !== undefined && trend >= 0 && trend <= 9) {
      return trend;
    } else if (sgvs[0]['direction'] !== undefined) {
      return directionToTrend(sgvs[0]['direction']);
    } else {
      return 0;
    }
  }

  function lastDelta(ys) {
    if (ys[1] === 0) {
      return c.NO_DELTA_VALUE;
    } else {
      return ys[0] - ys[1];
    }
  }

  function recency(sgvs) {
    if (sgvs.length === 0) {
      // TODO
      return 99 * 60 * 60;
    } else {
      var seconds = Date.now() / 1000 - sgvs[0]['date'];
      return Math.floor(seconds);
    }
  }

  function sendMessage(data) {
    console.log('sending ' + JSON.stringify(data));
    Pebble.sendAppMessage(data);
  }

  function requestAndSendBGs() {
    function onData(sgvs, statusText) {
      try {
        var ys = graphArray(sgvs);
        sendMessage({
          msgType: c.MSG_TYPE_DATA,
          recency: recency(sgvs),
          sgvCount: ys.length,
          // XXX: divide BG by 2 to fit into 1 byte
          sgvs: ys.map(function(y) { return Math.min(255, Math.floor(y / 2)); }),
          lastSgv: lastSgv(sgvs),
          trend: lastTrendNumber(sgvs),
          delta: lastDelta(ys),
          statusText: statusText,
        });
      } catch (e) {
        sgvDataError(e);
      }
    }

    getSGVsDateDescending(config, function(err, sgvs) {
      if (err) {
        // error fetching sgvs is unrecoverable
        sgvDataError(err);
      } else {
        getStatusText(config, function(err, statusText) {
          if (err) {
            // error fetching status bar text is okay
            console.log(err);
            statusText = '-';
          }
          onData(sgvs, statusText);
        });
      }
    });
  }

  function sendPreferences() {
    sendMessage({
      msgType: c.MSG_TYPE_PREFERENCES,
      mmol: config.mmol,
      topOfGraph: config.topOfGraph,
      topOfRange: config.topOfRange,
      bottomOfRange: config.bottomOfRange,
      bottomOfGraph: config.bottomOfGraph,
      hGridlines: config.hGridlines,
      timeAlign: c.ALIGN[config.timeAlign],
      batteryLoc: c.BATTERY_LOC[config.batteryLoc],
    });
  }

  Pebble.addEventListener('ready', function() {
    config = mergeConfig({}, c.DEFAULT_CONFIG);

    var configStr = localStorage.getItem(c.LOCAL_STORAGE_KEY_CONFIG);
    if (configStr !== null) {
      try {
        config = mergeConfig(JSON.parse(configStr), c.DEFAULT_CONFIG);
      } catch (e) {
        console.log('Bad config from localStorage: ' + configStr);
      }
    }

    Pebble.addEventListener('showConfiguration', function() {
      Pebble.openURL(c.CONFIG_URL + '?version=' + c.VERSION + '&current=' + encodeURIComponent(JSON.stringify(config)));
    });

    Pebble.addEventListener('webviewclosed', function(event) {
      var configStr = decodeURIComponent(event.response);
      try {
        var newConfig = JSON.parse(configStr);
        config = mergeConfig(newConfig, c.DEFAULT_CONFIG);
        localStorage.setItem(c.LOCAL_STORAGE_KEY_CONFIG, JSON.stringify(config));
        console.log('Preferences updated: ' + JSON.stringify(config));
        sendPreferences();
        requestAndSendBGs();
      } catch (e) {
        console.log(e);
        console.log('Bad config from webview: ' + configStr);
      }
    });

    Pebble.addEventListener('appmessage', function() {
      requestAndSendBGs();
    });

    // Send data immediately after the watchface is launched
    requestAndSendBGs();
  });

}
