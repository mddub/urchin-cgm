/* global document */
(function() {

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
    ['gub', 'glb', 'ghl', 'gll'].forEach(function(sliderKey) {
      document.getElementById(sliderKey).value = current[sliderKey] || '';
      document.getElementById(sliderKey + '-val').value = current[sliderKey] || '';
    });
  })();

  function buildConfig() {
    var mmol = document.getElementById('units-mgdl').className.indexOf('active') === -1;
    return {
      mmol: mmol,
      nightscout_url: document.getElementById('ns-url').value.replace(/\/$/, ''),
      gub: tryParseInt(document.getElementById('gub').value),
      glb: tryParseInt(document.getElementById('glb').value),
      ghl: tryParseInt(document.getElementById('ghl').value),
      gll: tryParseInt(document.getElementById('gll').value),
    };
  }

  function onSubmit(e) {
    e.preventDefault();
    document.location = getQueryParam('return_to', 'pebblejs://close#') + JSON.stringify(buildConfig());
  }

  document.getElementById('config-form').addEventListener('submit', onSubmit);
}());
