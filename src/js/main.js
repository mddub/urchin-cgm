/* jshint browser: true */
/* global console, Pebble */

var SGV_FETCH_COUNT = 72;
var SGV_FOR_PEBBLE_COUNT = 36;
var INTERVAL_SIZE_SECONDS = 5 * 60;
var IOB_RECENCY_THRESHOLD_SECONDS = 10 * 60;
var REQUEST_TIMEOUT = 5000;
var NO_DELTA_VALUE = 65536;

var CONFIG_URL = 'https://mddub.github.io/nightscout-graph-pebble/config/';
var LOCAL_STORAGE_KEY_CONFIG = 'config';

var MSG_TYPE_ERROR = 0;
var MSG_TYPE_DATA = 1;
var MSG_TYPE_PREFERENCES = 2;

var config = {
  nightscout_url: '',
  mmol: false,
};

function handleError(e) {
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
        callback(xhr.responseText);
      } else {
        handleError(new Error('Request failed, status ' + xhr.status + ': ' + url));
      }
    }
  };
  xhr.send(null);

  setTimeout(function() {
    if (received) {
      return;
    }
    timedOut = true;
    handleError(new Error('Request timed out: ' + url));
  }, REQUEST_TIMEOUT);
}

function getJSON(url, callback) {
  getURL(url, function(result) {
    try {
      callback(JSON.parse(result));
    } catch (e) {
      handleError(e);
    }
  });
}

function getIOB(callback) {
  getJSON(config.nightscout_url + '/api/v1/entries.json?find[activeInsulin][$exists]=true&count=1', function(iobs) {
    if(iobs.length && Date.now() - iobs[0]['date'] <= IOB_RECENCY_THRESHOLD_SECONDS * 1000) {
      var recency = Math.floor((Date.now() - iobs[0]['date']) / (60 * 1000));
      var iob = iobs[0]['activeInsulin'].toFixed(1).toString() + ' u (' + recency + ')';
      callback(iob);
    } else {
      callback('-');
    }
  });
}

function getSGVsDateDescending(callback) {
  getJSON(config.nightscout_url + '/api/v1/entries/sgv.json?count=' + SGV_FETCH_COUNT, function(entries) {
    callback(entries.map(function(e) {
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
  for(i = SGV_FOR_PEBBLE_COUNT - 1; i >= 0; i--) {
    graphed.push(noEntry);
    xs.push(endTime - i * INTERVAL_SIZE_SECONDS);
  }

  // This n^2 algorithm sacrifices efficiency for clarity
  for(i = 0; i < sgvs.length; i++) {
    var min = Infinity;
    var xi;
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
  }[direction];
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
  if (ys[ys.length - 2] === 0) {
    return NO_DELTA_VALUE;
  } else {
    return ys[ys.length - 1] - ys[ys.length - 2];
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
  function onData(sgvs, iobText) {
    try {
      var ys = graphArray(sgvs);
      sendMessage({
        msgType: MSG_TYPE_DATA,
        recency: recency(sgvs),
        // XXX: divide BG by 2 to fit into 1 byte
        sgvs: ys.map(function(y) { return Math.min(255, Math.floor(y / 2)); }),
        lastSgv: lastSgv(sgvs),
        trend: lastTrendNumber(sgvs),
        delta: lastDelta(ys),
        statusText: iobText,
      });
    } catch (e) {
      handleError(e);
    }
  }

  getSGVsDateDescending(function(sgvs) {
    getIOB(function(iobText) {
      onData(sgvs, iobText);
    });
  });
}

function sendPreferences() {
  sendMessage({
    msgType: MSG_TYPE_PREFERENCES,
    mmol: config.mmol,
  });
}

Pebble.addEventListener('ready', function() {
  var configStr = localStorage.getItem(LOCAL_STORAGE_KEY_CONFIG);
  if (configStr !== null) {
    try {
      config = JSON.parse(configStr);
    } catch (e) {
      console.log('Bad config: ' + configStr);
    }
  }

  Pebble.addEventListener('showConfiguration', function() {
    Pebble.openURL(CONFIG_URL + '?current=' + encodeURIComponent(JSON.stringify(config)));
  });

  Pebble.addEventListener('webviewclosed', function(e) {
    var configStr = decodeURIComponent(e.response);
    config = JSON.parse(configStr);
    localStorage.setItem(LOCAL_STORAGE_KEY_CONFIG, configStr);
    sendPreferences();
    requestAndSendBGs();
  });

  Pebble.addEventListener('appmessage', function() {
    requestAndSendBGs();
  });

  // Send data immediately after the watchface is launched
  requestAndSendBGs();
});
