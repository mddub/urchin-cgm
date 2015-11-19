/* global document, Zepto */
(function($) {

  var VERSION = '0.0.2';

  var SLIDER_KEYS = [
    'topOfGraph',
    'topOfRange',
    'bottomOfRange',
    'bottomOfGraph',
  ];

  // https://developer.getpebble.com/guides/pebble-apps/pebblekit-js/app-configuration/
  function getQueryParam(variable, defaultValue) {
    var query = document.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if (pair[0] === variable) {
        return decodeURIComponent(pair[1]);
      }
    }
    return defaultValue || false;
  }

  function tryParseInt(s) {
    return parseInt(s, 10) >= 0 ? parseInt(s, 10) : undefined;
  }

  (function populateValues() {
    var current = JSON.parse(getQueryParam('current', '{}'));
    document.getElementById('ns-url').value = current['nightscout_url'] || '';

    if (current.mmol === true) {
      document.getElementById('units-mmol').className += ' active';
    } else {
      document.getElementById('units-mgdl').className += ' active';
    }

    SLIDER_KEYS.forEach(function(key) {
      document.getElementById(key).value = current[key] || '';
      document.getElementById(key + '-val').value = current[key] || '';
    });

    document.getElementById('hGridlines').value = current['hGridlines'];

    document.getElementById('statusContent').value = current['statusContent'];
    document.getElementById('statusUrl').value = current['statusUrl'] || '';

    document.getElementById('batteryLoc').value = current['batteryLoc'];
    document.getElementById('timeAlign').value = current['timeAlign'];
  })();

  function buildConfig() {
    var mmol = document.getElementById('units-mgdl').className.indexOf('active') === -1;
    var out = {
      mmol: mmol,
      nightscout_url: document.getElementById('ns-url').value.replace(/\/$/, ''),
      hGridlines: tryParseInt(document.getElementById('hGridlines').value),
      statusContent: document.getElementById('statusContent').value,
      statusUrl: document.getElementById('statusUrl').value,
      timeAlign: document.getElementById('timeAlign').value,
      batteryLoc: document.getElementById('batteryLoc').value,
    };
    SLIDER_KEYS.forEach(function(key) {
      out[key] = tryParseInt(document.getElementById(key + '-val').value);
    });
    return out;
  }

  function onSubmit(e) {
    e.preventDefault();
    document.location = getQueryParam('return_to', 'pebblejs://close#') + JSON.stringify(buildConfig());
  }

  document.getElementById('config-form').addEventListener('submit', onSubmit);

  $('#statusContent').on('change', function(evt) {
    $('#status-url-container').toggle(evt.currentTarget.value === 'customurl');
  });
  $('#statusContent').trigger('change');

  $('#update-available #running-version').text(getQueryParam('version') || '0.0.0');
  $('#update-available #available-version').text(VERSION);
  $('#update-available').toggle(VERSION !== getQueryParam('version'));

})(Zepto);
