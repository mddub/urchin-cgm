/* jshint browser: true */
/* global console, module, Pebble, require */

require('./vendor/lie.polyfill');
var ga = require('./ga');

function app(Pebble, c) {

  var format = require('./format')(c);
  var points = require('./points')(c);
  var data;
  var config;
  var maxSGVs;

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

  function computeMaxSGVs(config) {
    return points.computeVisiblePoints(points.computeGraphWidth(getLayout(config)), config);
  }

  function sendDataFetchError(e) {
    console.log(e.stack);
    return sendMessage({msgType: c.MSG_TYPE_ERROR});
  }

  function sendMessage(data) {
    Object.keys(data).forEach(function(key) {
      // These must be explicitly sent as ints, since Pebble Android casts them to strings
      if (data[key] === true) {
        data[key] = 1;
      } else if (data[key] === false) {
        data[key] = 0;
      }
    });

    console.log('sending ' + JSON.stringify(data));
    return new Promise(function(resolve, reject) {
      Pebble.sendAppMessage(
        data,
        resolve,
        function(e) {
          console.log('Message failed: ' + JSON.stringify(e));
          reject(e);
        }
      );
    });
  }

  function requestAndSendData() {
    function onData(sgvs, bolusHistory, basalHistory, status) {
      try {
        var endTime = sgvs.length > 0 ? sgvs[0]['date'] : new Date();
        var ys = format.sgvArray(endTime, sgvs, maxSGVs);

        var boluses = format.bolusGraphArray(endTime, bolusHistory, maxSGVs);
        var basals = format.basalGraphArray(endTime, basalHistory, maxSGVs, config);
        var graphExtra = format.graphExtraArray(boluses, basals);

        return sendMessage({
          msgType: c.MSG_TYPE_DATA,
          recency: format.recency(sgvs),
          // XXX: divide BG by 2 to fit into 1 byte
          sgvs: ys.map(function(y) { return Math.min(255, Math.floor(y / 2)); }),
          lastSgv: format.lastSgv(sgvs),
          trend: format.lastTrendNumber(sgvs),
          delta: format.lastDelta(ys),
          statusText: status.text.substr(0, 255),
          graphExtra: graphExtra,
          statusRecency: status.recency === undefined ? -1 : status.recency,
        });
      } catch (e) {
        return sendDataFetchError(e);
      }
    }

    var sgvs = data.getSGVsDateDescending(config);
    var bolusHistory = config.bolusTicks ? data.getBolusHistory(config) : Promise.resolve([]);
    var basalHistory = config.basalGraph ? data.getBasalHistory(config) : Promise.resolve([]);
    // recover from status text errors
    var status = data.getStatusText(config).catch(function(e) {
      console.log(e.stack);
      return {text: '-'};
    });

    return Promise.all([sgvs, bolusHistory, basalHistory, status])
      .then(function(results) {
        return onData.apply(this, results);
      })
      .catch(sendDataFetchError);
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

  function colorHexTo8Bit(hexString) {
    // hexString should look like 0x55FFAA
    var r = (parseInt(hexString.substr(-6).substr(0, 2), 16) / 85);
    var g = (parseInt(hexString.substr(-6).substr(2, 2), 16) / 85);
    var b = (parseInt(hexString.substr(-6).substr(4, 2), 16) / 85);
    var a = 3;
    return (a << 6) + (r << 4) + (g << 2) + (b << 0);
  }

  function encodeColorsForPebble(config) {
    return c.COLOR_KEYS.map(function(key) {
      if (c.LAYOUT_COLOR_KEYS.indexOf(key) !== -1) {
        return colorHexTo8Bit(getLayout(config)[key]);
      } else {
        return colorHexTo8Bit(config[key]);
      }
    });
  }

  function sendPreferences() {
    return sendMessage({
      msgType: c.MSG_TYPE_PREFERENCES,
      mmol: config.mmol,
      topOfGraph: config.topOfGraph,
      topOfRange: config.topOfRange,
      bottomOfRange: config.bottomOfRange,
      bottomOfGraph: config.bottomOfGraph,
      hGridlines: config.hGridlines,
      batteryAsNumber: config.batteryAsNumber,
      basalGraph: config.basalGraph,
      basalHeight: config.basalHeight,
      updateEveryMinute: config.updateEveryMinute,
      timeAlign: c.ALIGN[getLayout(config).timeAlign],
      batteryLoc: c.BATTERY_LOC[getLayout(config).batteryLoc],
      connStatusLoc: c.CONN_STATUS_LOC[getLayout(config).connStatusLoc],
      recencyLoc: c.RECENCY_LOC[getLayout(config).recencyLoc],
      recencyStyle: c.RECENCY_STYLE[getLayout(config).recencyStyle],
      pointShape: c.POINT_SHAPE[config.pointShape],
      pointRectHeight: config.pointRectHeight,
      pointWidth: config.pointWidth,
      pointMargin: config.pointMargin,
      pointRightMargin: config.pointRightMargin,
      plotLine: config.plotLine,
      plotLineWidth: config.plotLineWidth,
      plotLineIsCustomColor: config.plotLineIsCustomColor,
      numElements: countElementsForPebble(getLayout(config)),
      elements: encodeElementsForPebble(getLayout(config)),
      colors: encodeColorsForPebble(config),
      statusMinRecencyToShowMinutes: config.statusMinRecencyToShowMinutes,
      statusMaxAgeMinutes: config.statusMaxAgeMinutes,
      statusRecencyFormat: c.STATUS_RECENCY_FORMAT[config.statusRecencyFormat],
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

    // can't initialize these until we know the graph config
    maxSGVs = computeMaxSGVs(config);
    data = require('./data')(c, maxSGVs);

    function getWatchInfo() {
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

      return {
        version: c.VERSION,
        pf: platform,
        fw: firmware,
        at: Pebble.getAccountToken(),
        wt: Pebble.getWatchToken(),
      };
    }

    Pebble.addEventListener('showConfiguration', function() {
      var watchInfo = getWatchInfo();

      var configHtml = require('./generated/config_page.json').configPage;
      configHtml = configHtml.replace('$$WATCH_INFO$$', encodeURIComponent(JSON.stringify(watchInfo)));
      configHtml = configHtml.replace('$$CURRENT$$', encodeURIComponent(JSON.stringify(config)));

      var configURL;
      if (c.DEV_CONFIG_URL) {
        // While developing on the config page, open the source HTML file rather
        // than the data-URI'd version of it
        configURL = c.DEV_CONFIG_URL + '?watchInfo=' + encodeURIComponent(JSON.stringify(watchInfo)) + '&current=' + encodeURIComponent(JSON.stringify(config));
      } else if (!Pebble || Pebble.platform === 'pypkjs') {
        // If in the emulator, proxy the config page (represented as data URI)
        // via a webpage which can read the return_to query parameter and
        // substitute it for $$RETURN_TO$$.
        configURL = c.CONFIG_PROXY_URL + '#' + encodeURIComponent(configHtml);
      } else {
        // In production, use the data URI to show the config page "offline."
        configHtml = configHtml.replace('$$RETURN_TO$$', 'pebblejs://close#');
        configURL = 'data:text/html;charset=utf-8,' + encodeURIComponent(configHtml);
      }
      Pebble.openURL(configURL);
    });

    Pebble.addEventListener('webviewclosed', function(event) {
      var newConfig;
      try {
        var configStr = event.response;
        if (configStr.substr(0, 1) !== '{') {
          // XXX: on iOS and Android it's already been decoded; on Pebble emulator it hasn't
          // See https://github.com/pebble/pebble-tool/pull/30
          configStr = decodeURIComponent(configStr);
        }
        newConfig = JSON.parse(configStr);
      } catch (e) {
        console.log(e);
        console.log('Bad config from webview: ' + event.response);
        return;
      }

      var oldNightscoutURL = config.nightscout_url;
      var oldMaxSGVs = computeMaxSGVs(config);

      config = mergeConfig(newConfig, c.DEFAULT_CONFIG);
      maxSGVs = computeMaxSGVs(config);
      data.setMaxSGVCount(maxSGVs);

      if (config.nightscout_url !== oldNightscoutURL || maxSGVs > oldMaxSGVs || config.__CLEAR_CACHE__) {
        data.clearCache();
        if (config.__CLEAR_CACHE__) {
          // present only for tests
          delete newConfig.__CLEAR_CACHE__;
        }
      }

      localStorage.setItem(c.LOCAL_STORAGE_KEY_CONFIG, JSON.stringify(config));
      console.log('Preferences updated: ' + JSON.stringify(config));
      sendPreferences()
        .then(requestAndSendData)
        .then(function() {
          ga.track(data, c.CONFIG_GA_ID, getWatchInfo(), config);
        });

    });

    Pebble.addEventListener('appmessage', function(e) {
      console.log('Received message from watch: ' + JSON.stringify(e.payload));
      requestAndSendData();
    });

    // Send data immediately after the watchface is launched
    requestAndSendData();
  });

}

module.exports = app;

if (typeof(Pebble) !== 'undefined') {
  app(Pebble, require('./generated/constants.json'));
}
