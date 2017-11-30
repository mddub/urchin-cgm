/* global module */

function track(data, trackingId, watchInfo, config) {
  // redact PII
  var current = JSON.parse(JSON.stringify(config));
  delete current['nightscout_url'];
  delete current['dexcomUsername'];
  delete current['dexcomPassword'];
  delete current['dexcomNonUS'];
  delete current['statusText'];
  delete current['statusUrl'];
  delete current['statusJsonUrl'];

  // GA limits paths to 2048 bytes, so send config and customLayout separately
  // https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#dp
  var customLayout = current['customLayout'];
  delete current['customLayout'];

  var ts = Math.round(new Date().getTime() / 1000);
  trackParams(data, trackingId, ts, watchInfo, {current: current});
  if (current['layout'] === 'custom') {
    trackParams(data, trackingId, ts, watchInfo, {customLayout: customLayout});
  }
}

function trackParams(data, trackingId, timestamp, watchInfo, extra) {
  var out = {ts: timestamp};
  [watchInfo, extra].forEach(function(obj) {
    Object.keys(obj).forEach(function(key) {
      if (obj[key] !== undefined) {
        out[key] = obj[key];
      }
    });
  });
  var host = 'mddub.github.io';
  var path = '/?c=' + JSON.stringify(out);
  return sendPageview(data, trackingId, watchInfo.wt, host, path);
}

function sendPageview(data, trackingId, clientId, host, path) {
  // https://developers.google.com/analytics/devguides/collection/protocol/v1/reference#payload
  var payload = [
    ['v', '1'],
    ['tid', trackingId],
    ['cid', clientId],
    ['t', 'pageview'],
    ['dh', host],
    ['dp', path],
  ].map(function(pair) {
    return pair[0] + '=' + encodeURIComponent(pair[1]);
  }).join('&');

  return data.postURL('https://www.google-analytics.com/collect', {}, payload);
}

module.exports = {
  track: track
};
