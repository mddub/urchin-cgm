var SGV_FETCH_COUNT = 72;
var SGV_FOR_PEBBLE_COUNT = 36;
var INTERVAL_SIZE_SECONDS = 5 * 60;
var IOB_RECENCY_THRESHOLD_SECONDS = 10 * 60;
var REQUEST_TIMEOUT = 5000;

var syncGetJSON = function (url) {
  // async == false, since timeout/ontimeout is broken for Pebble XHR
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, false);
  xhr.setRequestHeader('Content-type', 'application/json');
  xhr.timeout = REQUEST_TIMEOUT;
  xhr.send();

  if(xhr.status === 200) {
    return JSON.parse(xhr.responseText);
  } else if(xhr.status === null || xhr.status === 0) {
    throw new Error('Request timed out');
  } else {
    throw new Error('Request failed, status ' + xhr.status);
  }
};

function getIOB() {
  var iobs = syncGetJSON(NIGHTSCOUT_URL_BASE + '/api/v1/entries.json?find[activeInsulin][$exists]=true&count=1');
  if(iobs.length && Date.now() - iobs[0]['date'] <= IOB_RECENCY_THRESHOLD_SECONDS * 1000) {
    var recency = Math.floor((Date.now() - iobs[0]['date']) / (60 * 1000));
    return iobs[0]['activeInsulin'].toFixed(1).toString() + ' u (' + recency + ')';
  } else {
    return '-';
  }
}

function getSGVsDateDescending() {
  var entries = syncGetJSON(NIGHTSCOUT_URL_BASE + '/api/v1/entries/sgv.json?count=' + SGV_FETCH_COUNT);
  entries.forEach(function(e) {
    e['date'] = e['date'] / 1000;
  });
  return entries;
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

  // TODO Pebble should do all the padding
  var now = Date.now() / 1000;
  var stalePadding = Math.floor((now - endTime) / INTERVAL_SIZE_SECONDS);
  for(i = 0; i < stalePadding; i++) {
    ys.shift();
    ys.push(0);
  }

  return ys;
}

function lastSgv(sgvs) {
  return parseInt(sgvs[0]['sgv'], 10);
}

function lastTrendNumber(sgvs) {
  var trend = sgvs[0]['trend'];
  if (trend !== undefined && trend >= 0 && trend <= 9) {
    return trend;
  } else {
    return 0;
  }
}

function lastDelta(ys) {
  if (ys[ys.length - 1] === 0 || ys[ys.length - 2] === 0) {
    return '-';
  } else {
    var delta = ys[ys.length - 1] - ys[ys.length - 2];
    return (delta >= 0 ? '+' : '') + delta;
  }
}

function recency(sgvs) {
  var seconds = Date.now() / 1000 - sgvs[0]['date'];
  return Math.floor(seconds);
}

function requestAndSendBGs() {
  try {
    var sgvs = getSGVsDateDescending();
    var ys = graphArray(sgvs);
    var data = {
      recency: recency(sgvs),
      sgvs: ys,
      lastSgv: lastSgv(sgvs),
      trend: lastTrendNumber(sgvs),
      delta: lastDelta(ys),
      statusText: getIOB()
    };
    console.log('sending ' + JSON.stringify(data));
    var transactionId = Pebble.sendAppMessage(
      data,
      function(e) {
        console.log('success');
      },
      function(e) {
        console.log('failed: ' + JSON.stringify(e));
      }
    );
  }
  catch (e) {
    // Don't need error handling because watch will just retry
    console.log(e);
  }
}

Pebble.addEventListener('ready', function(e) {
  Pebble.addEventListener('appmessage', function(e) {
    requestAndSendBGs();
  });

  // Send data immediately after the watchface is launched
  requestAndSendBGs();
});
