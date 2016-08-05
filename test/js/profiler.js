/* jshint node: true */

/*
 * Run the Urchin request loop repeatedly, for profiling.
 *
 * This requires installing a few Node modules:
 *   npm install v8-profiler
 *   npm install node-inspector
 *   npm install xmlhttprequest
 *
 * Run this from the command line with a file containing Urchin config JSON:
 *   node --debug profiler.js config.json
 *
 * Config JSON can be obtained by running the emulator, watching logs with
 * `pebble logs`, opening the settings page with `pebble emu-app-config`,
 * saving, and copying the result from the "Preferences updated:" line.
 *
 * Then run separately:
 *   node-inspector
 * and use the Chrome debugger to take heap snapshots.
 *
 * Resources:
 *   https://github.com/felixge/node-memory-leak-tutorial
 *   https://www.youtube.com/watch?v=L3ugr9BJqIs
 *
 * (Committing this mostly so I can repurpose it later for integration tests.)
 */

require('v8-profiler');

global.localStorage = require('./make_mock_local_storage.js')();
global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

var configFile = process.argv[2];
if (configFile === undefined) {
  console.error('Missing config.json argument');
  process.exit(1);
}
var config = JSON.parse(require('fs').readFileSync(configFile));

var _getItem = global.localStorage.getItem;
global.localStorage.getItem = function(key) {
  if (key === c.LOCAL_STORAGE_KEY_CONFIG) {
    return JSON.stringify(config);
  } else {
    return _getItem(key);
  }
};

var _messageHandler;
var Pebble = {};
Pebble.addEventListener = function(e, fn) {
  if (e === 'ready') {
    fn();
  } else if (e === 'appmessage') {
    _messageHandler = fn;
  }
};
Pebble.sendAppMessage = function() {
  console.log('[' + new Date().toISOString() + ' SENT]\n');
};

var c = require('../../src/js/constants.json');
var app = require('../../src/js/app');
app(Pebble, c);

(function loop() {
  _messageHandler({payload: {}});
  setTimeout(loop, 15 * 1000);
})();
