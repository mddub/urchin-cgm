/* jshint browser: true */
/* global console, Pebble, Data, Format */
/* exported main */

function main(c) {

  var data = Data(c);
  var format = Format(c);
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

  function dataFetchError(e) {
    console.log(e.stack);
    sendMessage({msgType: c.MSG_TYPE_ERROR});
  }

  function sendMessage(data) {
    console.log('sending ' + JSON.stringify(data));
    Pebble.sendAppMessage(data);
  }

  function requestAndSendData() {
    function onData(sgvs, bolusHistory, basalHistory, statusText) {
      try {
        var endTime = sgvs.length > 0 ? sgvs[0]['date'] : new Date();
        var ys = format.sgvArray(endTime, sgvs);

        var boluses = format.bolusGraphArray(endTime, bolusHistory);
        var basals = format.basalGraphArray(endTime, basalHistory, config);
        var graphExtra = format.graphExtraArray(boluses, basals);

        sendMessage({
          msgType: c.MSG_TYPE_DATA,
          recency: format.recency(sgvs),
          sgvCount: ys.length,
          // XXX: divide BG by 2 to fit into 1 byte
          sgvs: ys.map(function(y) { return Math.min(255, Math.floor(y / 2)); }),
          lastSgv: format.lastSgv(sgvs),
          trend: format.lastTrendNumber(sgvs),
          delta: format.lastDelta(ys),
          statusText: statusText,
          graphExtra: graphExtra,
        });
      } catch (e) {
        dataFetchError(e);
      }
    }

    var sgvs = data.getSGVsDateDescending(config);
    var bolusHistory = config.bolusTicks ? data.getBolusHistory(config) : Promise.resolve([]);
    var basalHistory = config.basalGraph ? data.getBasalHistory(config) : Promise.resolve([]);
    // recover from status text errors
    var statusText = data.getStatusText(config).catch(function(e) {
      console.log(e.stack);
      return '-';
    });

    Promise.all([sgvs, bolusHistory, basalHistory, statusText])
      .then(function(results) {
        onData.apply(this, results);
      })
      .catch(dataFetchError);
  }

  function getLayout(config) {
    return config.layout === 'custom' ? config.customLayout : c.LAYOUTS[config.layout];
  }

  function countElementsForPebble(layout) {
    return layout.elements.filter(function(elementConfig) {
      return elementConfig['enabled'];
    }).length;
  }

  function encodeElementsForPebble(layout) {
    var out = [];
    layout.elements.forEach(function(elementConfig) {
      if (elementConfig['enabled']) {
        out = out.concat(c.PROPERTIES.map(function(prop) {
          if (typeof elementConfig[prop] === 'boolean') {
            return elementConfig[prop] ? 1 : 0;
          } else {
            return elementConfig[prop];
          }
        }));
      }
    });
    return out;
  }

  function sendPreferences() {
    sendMessage({
      msgType: c.MSG_TYPE_PREFERENCES,
      mmol: config.mmol ? 1 : 0,
      topOfGraph: config.topOfGraph,
      topOfRange: config.topOfRange,
      bottomOfRange: config.bottomOfRange,
      bottomOfGraph: config.bottomOfGraph,
      hGridlines: config.hGridlines,
      batteryAsNumber: config.batteryAsNumber ? 1 : 0,
      basalGraph: config.basalGraph ? 1 : 0,
      basalHeight: config.basalHeight,
      updateEveryMinute: config.updateEveryMinute ? 1 : 0,
      timeAlign: c.ALIGN[getLayout(config).timeAlign],
      batteryLoc: c.BATTERY_LOC[getLayout(config).batteryLoc],
      numElements: countElementsForPebble(getLayout(config)),
      elements: encodeElementsForPebble(getLayout(config)),
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
      var platform = 'unknown';
      var firmware = '0.0.0';
      if (Pebble.getActiveWatchInfo) {
        platform = Pebble.getActiveWatchInfo()['platform'];
        firmware = ['major', 'minor', 'patch'].map(function(part) {
          return Pebble.getActiveWatchInfo()['firmware'][part];
        }).join('.');
        if (Pebble.getActiveWatchInfo()['firmware']['suffix']) {
          firmware += '.' + Pebble.getActiveWatchInfo()['firmware']['suffix'];
        }
      }
      var query = [
        ['version', c.VERSION],
        ['pf', platform],
        ['fw', firmware],
        ['at', Pebble.getAccountToken()],
        ['wt', Pebble.getWatchToken()],
        ['current', encodeURIComponent(JSON.stringify(config))],
      ].map(function(pair) {
        return pair.join('=');
      }).join('&');
      Pebble.openURL(c.CONFIG_URL + '?' + query);
    });

    Pebble.addEventListener('webviewclosed', function(event) {
      var configStr = decodeURIComponent(event.response);
      var newConfig;
      try {
        newConfig = JSON.parse(configStr);
      } catch (e) {
        console.log(e);
        console.log('Bad config from webview: ' + configStr);
      }

      if (newConfig) {
        if (newConfig.nightscout_url !== config.nightscout_url) {
          data.clearCache();
        }
        config = mergeConfig(newConfig, c.DEFAULT_CONFIG);
        localStorage.setItem(c.LOCAL_STORAGE_KEY_CONFIG, JSON.stringify(config));
        console.log('Preferences updated: ' + JSON.stringify(config));
        sendPreferences();
        requestAndSendData();
      }
    });

    Pebble.addEventListener('appmessage', function() {
      requestAndSendData();
    });

    // Send data immediately after the watchface is launched
    requestAndSendData();
  });

}
