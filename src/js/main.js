/* jshint browser: true */
/* global console, Pebble */

// TODO use a real build process to share this with the config page
var VERSION = '0.0.2';

var SGV_FETCH_SECONDS = 4 * 60 * 60;
var INTERVAL_SIZE_SECONDS = 5 * 60;
var FETCH_EXTRA = 5;
var IOB_RECENCY_THRESHOLD_SECONDS = 10 * 60;
var REQUEST_TIMEOUT = 5000;
var NO_DELTA_VALUE = 65536;
var DEXCOM_ERROR_CODE_MAX = 12;

var CONFIG_URL = 'https://mddub.github.io/nightscout-graph-pebble/config/';
var LOCAL_STORAGE_KEY_CONFIG = 'config';

var MSG_TYPE_ERROR = 0;
var MSG_TYPE_DATA = 1;
var MSG_TYPE_PREFERENCES = 2;

var DEFAULT_CONFIG = {
  nightscout_url: '',
  mmol: false,
  topOfGraph: 250,
  topOfRange: 200,
  bottomOfRange: 70,
  bottomOfGraph: 40,
  hGridlines: 50,
  statusContent: 'pumpiob',
  statusUrl: '',
  timeAlign: 'center',
  batteryLoc: 'statusRight',
};

var ALIGN = {
  'left': 0,
  'center': 1,
  'right': 2,
};

var BATTERY_LOC = {
  'none': 0,
  'statusRight': 1,
  'timeTopLeft': 2,
  'timeTopRight': 3,
  'timeBottomLeft': 4,
  'timeBottomRight': 5,
};

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
  sendMessage({msgType: MSG_TYPE_ERROR});
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
    setTimeout(onTimeout, REQUEST_TIMEOUT);
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
    if(iobs.length && Date.now() - iobs[0]['date'] <= IOB_RECENCY_THRESHOLD_SECONDS * 1000) {
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

function getStatusText(config, callback) {
  var defaultFn = getIOB;
  var fn = {
    'pumpiob': getIOB,
    'customurl': getCustomUrl,
  }[config.statusContent];
  (fn || defaultFn)(config, callback);
}

function getSGVsDateDescending(config, callback) {
  var fetchStart = Date.now() - SGV_FETCH_SECONDS * 1000;
  var points = SGV_FETCH_SECONDS / INTERVAL_SIZE_SECONDS + FETCH_EXTRA;
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
  var endTime = sgvs[0]['date'];
  var noEntry = {
    'date': Infinity,
    'sgv': 0
  };
  var i;

  var graphed = [];
  var xs = [];
  for(i = 0; i <= SGV_FETCH_SECONDS; i += INTERVAL_SIZE_SECONDS) {
    graphed.push(noEntry);
    xs.push(endTime - i);
  }

  for(i = 0; i < sgvs.length; i++) {
    var min = Infinity;
    var xi;
    // Don't graph error codes
    if(sgvs[i]['sgv'] <= DEXCOM_ERROR_CODE_MAX) {
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
    if(min < INTERVAL_SIZE_SECONDS && Math.abs(sgvs[i]['date'] - xs[xi]) < Math.abs(graphed[xi]['date'] - xs[xi])) {
      graphed[xi] = sgvs[i];
    }
  }

  var ys = graphed.map(function(entry) { return entry['sgv']; });

  return ys;
}

function lastSgv(sgvs) {
  return parseInt(sgvs[0]['sgv'], 10);
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
    return NO_DELTA_VALUE;
  } else {
    return ys[0] - ys[1];
  }
}

function recency(sgvs) {
  var seconds = Date.now() / 1000 - sgvs[0]['date'];
  return Math.floor(seconds);
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
        msgType: MSG_TYPE_DATA,
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
    msgType: MSG_TYPE_PREFERENCES,
    mmol: config.mmol,
    topOfGraph: config.topOfGraph,
    topOfRange: config.topOfRange,
    bottomOfRange: config.bottomOfRange,
    bottomOfGraph: config.bottomOfGraph,
    hGridlines: config.hGridlines,
    timeAlign: ALIGN[config.timeAlign],
    batteryLoc: BATTERY_LOC[config.batteryLoc],
  });
}

Pebble.addEventListener('ready', function() {
  config = mergeConfig({}, DEFAULT_CONFIG);

  var configStr = localStorage.getItem(LOCAL_STORAGE_KEY_CONFIG);
  if (configStr !== null) {
    try {
      config = mergeConfig(JSON.parse(configStr), DEFAULT_CONFIG);
    } catch (e) {
      console.log('Bad config from localStorage: ' + configStr);
    }
  }

  Pebble.addEventListener('showConfiguration', function() {
    Pebble.openURL(CONFIG_URL + '?version=' + VERSION + '&current=' + encodeURIComponent(JSON.stringify(config)));
  });

  Pebble.addEventListener('webviewclosed', function(event) {
    var configStr = decodeURIComponent(event.response);
    try {
      var newConfig = JSON.parse(configStr);
      config = mergeConfig(newConfig, DEFAULT_CONFIG);
      localStorage.setItem(LOCAL_STORAGE_KEY_CONFIG, JSON.stringify(config));
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
