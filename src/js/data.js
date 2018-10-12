/* jshint browser: true */
/* global console, module, require */

require('./vendor/lie.polyfill');

var cache = require('./cache');
var debounce = require('./debounce');
var Debug = require('./debug');
var statusFormatters = require('./status_formatters');

var data = function(c, maxSGVCount) {
  var MAX_UPLOADER_BATTERIES = 1;
  var MAX_CALIBRATIONS = 1;
  var MAX_OPENAPS_STATUSES = 24;
  var MAX_LOOP_STATUSES = 1;
  var MAX_LOOP_ENACTED = 1;
  var MAX_BOLUSES_PER_HOUR_TO_CACHE = 6;

  var sgvCache = new cache.WithMaxAge('sgv', (maxSGVCount + 1) * 5 * 60);
  var tempBasalCache = new cache.WithMaxSize('tempBasal', maxSGVCount);
  var bolusCache = new cache.WithMaxSize('bolus', Math.ceil(maxSGVCount / 12 * MAX_BOLUSES_PER_HOUR_TO_CACHE));
  var uploaderBatteryCache = new cache.WithMaxSize('uploaderBattery', MAX_UPLOADER_BATTERIES);
  var calibrationCache = new cache.WithMaxSize('calibration', MAX_CALIBRATIONS);
  var loopStatusCache = new cache.WithMaxSize('loop', MAX_LOOP_STATUSES);
  var loopEnactedCache = new cache.WithMaxSize('loopEnacted', MAX_LOOP_ENACTED);
  var openAPSStatusCache = new cache.WithMaxSize('openAPSStatus', MAX_OPENAPS_STATUSES);
  var profileCache;

  // TODO this file should be split into several smaller modules
  var DEXCOM_SERVER = 'https://share1.dexcom.com';
  var DEXCOM_LOGIN_PATH = '/ShareWebServices/Services/General/LoginPublisherAccountByName';
  var DEXCOM_LATEST_GLUCOSE_PATH = '/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues';
  var DEXCOM_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0',
  };
  // From the Dexcom Share iOS app, via @bewest and @shanselman:
  // https://github.com/bewest/share2nightscout-bridge
  var DEXCOM_APPLICATION_ID = 'd89443d2-327c-4a6f-89e5-496bbb0317db';
  var dexcomToken;

  var debug = Debug(c);

  var d = {};

  d.clearCache = function() {
    sgvCache.clear();
    tempBasalCache.clear();
    bolusCache.clear();
    uploaderBatteryCache.clear();
    calibrationCache.clear();
    loopStatusCache.clear();
    loopEnactedCache.clear();
    openAPSStatusCache.clear();
    profileCache = undefined;
    dexcomToken = undefined;
  };

  d.setMaxSGVCount = function(count) {
    maxSGVCount = count;
    sgvCache.setMaxSecondsOld((count + 1) * 5 * 60);
    tempBasalCache.setMaxSize(count);
    bolusCache.setMaxSize(Math.ceil(count / 12 * MAX_BOLUSES_PER_HOUR_TO_CACHE));
  };

  d.fetch = function(url, method, headers, body) {
    return new Promise(function(resolve, reject) {
      var received = false;
      var timedOut = false;

      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      Object.keys(headers).forEach(function(h) {
        xhr.setRequestHeader(h, headers[h]);
      });
      xhr.onreadystatechange = function () {
        if (timedOut) {
          return;
        }
        if (xhr.readyState === 4) {
          received = true;
          if (xhr.status === 200) {
            resolve(xhr.responseText);
          } else {
            var msg = 'Request failed, status ' + xhr.status + ': ' + url + (xhr.responseText ? '\n' + xhr.responseText : '');
            reject(new Error(msg));
          }
        }
      };

      // In PebbleKit JS, specifying a timeout works only for synchronous XHR,
      // except on Android, where synchronous XHR doesn't work at all.
      // https://forums.getpebble.com/discussion/13224/problem-with-xmlhttprequest-timeout
      function onTimeout() {
        if (received) {
          return;
        }
        timedOut = true;
        xhr.abort();
        reject(new Error('Request timed out: ' + url));
      }

      // On iOS, PebbleKit JS will throw an error on send() for an invalid URL
      try {
        debug.log(method + ' ' + url);
        xhr.send(body);
        setTimeout(onTimeout, c.REQUEST_TIMEOUT);
      } catch (e) {
        reject(e);
      }
    });
  };

  d.getURL = function(url) {
    return d.fetch(url, 'GET', {'Cache-Control': 'no-cache'}, null);
  };

  d.getJSON = function(url) {
    return d.getURL(url).then(function(result) {
      return JSON.parse(result);
    });
  };

  d.postURL = function(url, headers, body) {
    return d.fetch(url, 'POST', headers, body);
  };

  d.postJSON = function(url, headers, data) {
    var body = data === undefined ? undefined : JSON.stringify(data);
    return d.postURL(url, headers, body).then(function(result) {
      return JSON.parse(result);
    });
  };

  d.getPebbleEndpoint = debounce(function(config) {
    return d.getJSON(config.nightscout_url + '/pebble').then(function(pebbleData) {
      if (pebbleData['bgs'] !== undefined && pebbleData['bgs'].length) {
        return pebbleData['bgs'][0];
      } else {
        return undefined;
      }
    });
  });

  d.getPebbleIOB = function(config) {
    // As of Nightscout 0.9.0-beta1, the /pebble endpoint will return either
    // Care Portal or devicestatus IOB depending on what's available.
    // https://github.com/nightscout/cgm-remote-monitor/pull/1560
    return d.getPebbleEndpoint(config).then(function(data) {
      if (data && !isNaN(parseFloat(data['iob']))) {
        return {
          text: parseFloat(data['iob']).toFixed(1).toString() + ' U',
          recency: 0,
        };
      } else {
        return '-';
      }
    });
  };

  d.getPebbleIOBAndCOB = function(config) {
    return d.getPebbleEndpoint(config).then(function(data) {
      var out = [];
      if (data && !isNaN(parseFloat(data['iob']))) {
        out.push(parseFloat(data['iob']).toFixed(1).toString() + ' U');
      }
      if (data && !isNaN(parseFloat(data['cob']))) {
        out.push(Math.round(parseFloat(data['cob'])) + ' g');
      }
      if (out.length > 0) {
        return {text: out.join('  '), recency: 0};
      } else {
        return {text: '-'};
      }
    });
  };

  d.getCustomText = function(config) {
    return Promise.resolve(
      {text: (config.statusText || '').substr(0, 255)}
    );
  };

  function uncacheableUrl(url) {
    // XXX: No combination of request headers seems capable of circumventing bad caching behavior for Pebble on iOS
    return url + (url.indexOf('?') !== -1 ? '&' : '?') + '_=' + Date.now();
  }

  d.getCustomUrl = function(config) {
    return d.getURL(uncacheableUrl(config.statusUrl)).then(function(data) {
      return {
        text: data.replace(/(^\n+|\n+$)/g, '').substr(0, 255) || '-'
      };
    });
  };

  d.getCustomJsonUrl = function(config) {
    return d.getURL(uncacheableUrl(config.statusJsonUrl)).then(function(raw) {
      var data = JSON.parse(raw);
      if (data instanceof Array) {
        data = data[0];
      }
      if (data['content'] === undefined) {
        return {text: '-'};
      }

      var recency;
      if (data['timestamp'] !== undefined) {
        var ms = (Math.log(data['timestamp']) / Math.log(10) < 12 ? 1000 : 1) * data['timestamp'];
        recency = Math.round((Date.now() - ms) / 1000);
      }
      return {
        text: data['content'].substr(0, 255),
        recency: recency,
      };
    });
  };

  d.getRigBatteryLevel = function(config) {
    return d.getLastUploaderBattery(config).then(function(latest) {
      if (latest && latest.length) {
        var battery;
        if (latest[0].uploader) {
          battery = latest[0].uploader.battery + '%';
        } else {
          battery = latest[0]['uploaderBattery'] + '%';
        }
        return {
          text: battery,
          recency: Math.round((Date.now() - new Date(latest[0]['created_at'])) / 1000),
        };
      } else {
        return {text: '-'};
      }
    });
  };

  d.getRawData = function(config) {
    return Promise.all([
      d.getLastCalibration(config),
      d.getSGVsDateDescending(config),
    ]).then(function(results) {
      var calRecord = results[0],
        sgvRecords = results[1];

      if (calRecord && calRecord.length && sgvRecords && sgvRecords.length) {
        var noiseStr = c.DEXCOM_NOISE_STRINGS[sgvRecords[0]['noise']];

        // make shallow copy since this array is shared
        sgvRecords = sgvRecords.slice(0)
          .sort(function(a, b) {
            return a['date'] - b['date'];
          })
          .slice(sgvRecords.length - config.statusRawCount);

        var sgvString = sgvRecords.map(function(bg) {
          return _getRawMgdl(bg, calRecord[0]);
        }).map(function(mgdl) {
          return (config.mmol && !isNaN(mgdl)) ? (mgdl / 18.0).toFixed(1) : mgdl;
        }).join(' ');

        return {text: (noiseStr ? noiseStr + ' ' : '') + sgvString};
      } else {
        return {text: '-'};
      }
    });
  };

  function _getRawMgdl(sgvRecord, calRecord) {
    if (sgvRecord.unfiltered) {
      if (sgvRecord.sgv && sgvRecord.sgv >= 40 && sgvRecord.sgv <= 400 && sgvRecord.filtered) {
        var ratio = calRecord.scale * (sgvRecord.filtered - calRecord.intercept) / calRecord.slope / sgvRecord.sgv;
        return Math.round(calRecord.scale * (sgvRecord.unfiltered - calRecord.intercept) / calRecord.slope / ratio);
      } else {
        return Math.round(calRecord.scale * (sgvRecord.unfiltered - calRecord.intercept) / calRecord.slope);
      }
    } else {
      return undefined;
    }
  }

  d.getRigBatteryAndRawData = function(config) {
    return Promise.all([
      d.getRigBatteryLevel(config),
      d.getRawData(config),
    ]).then(function(results) {
      var rigBattery = results[0];
      var text = results.map(function(v) {
        return v.text;
      }).filter(
        function(v) { return v !== '-'; }
      ).join(' ') || '-';
      return {text: text, recency: rigBattery.recency};
    });
  };

  function _basalsFromProfile(profile) {
    if (profile.length && profile[0]['basal']) {
      return profile[0]['basal'];
    } else if (profile.length && profile[0]['defaultProfile']) {
      return profile[0]['store'][profile[0]['defaultProfile']]['basal'];
    } else {
      return [];
    }
  }

  function _profileBasalRateAtTime(basals, mills) {
    // Lexicographically compare current time with HH:MM basal start times
    // TODO: don't assume phone timezone and profile timezone are the same
    var nowHHMM = new Date(mills).toTimeString().substr(0, 5);
    var basal = basals.filter(function(basal, i) {
      return (basal['time'] <= nowHHMM && (i === basals.length - 1 || nowHHMM < basals[i + 1]['time']));
    })[0];
    return parseFloat(basal['value']);
  }

  function _getCurrentProfileBasal(config) {
    return d.getProfile(config).then(function(profile) {
      var basals = _basalsFromProfile(profile);
      if (basals.length) {
        return _profileBasalRateAtTime(basals, Date.now());
      } else {
        return undefined;
      }
    });
  }

  function _getLastTempBasal(config) {
    return d.getTempBasals(config).then(function(treatments) {
      if (treatments.length && treatments[0]['duration']) {
        var start = new Date(treatments[0]['created_at']);
        var rate;
        var ratePercent;
        var rateType;
        if (treatments[0]['percent']) {
          rate = 0;
          ratePercent = treatments[0]['percent'];
          rateType = 'percent';
        } else {
          rate = parseFloat(treatments[0]['absolute']);
          ratePercent = null;
          rateType = 'absolute';
        }
        return {start: start, rate: rate, duration: parseFloat(treatments[0]['duration']), rate_percent: ratePercent, rate_type : rateType };
      } else {
        return undefined;
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

  d.getActiveBasal = function(config) {
    // adapted from @audiefile: https://github.com/mddub/urchin-cgm/pull/1
    return Promise.all([
      _getCurrentProfileBasal(config),
      _getLastTempBasal(config),
    ]).then(function(results) {
      var profileBasal = results[0],
        tempBasal = results[1];

      if (profileBasal === undefined && tempBasal === undefined) {
        return {text: '-'};
      } else if (tempBasal !== undefined && Date.now() - tempBasal.start < tempBasal.duration * 60 * 1000) {

          if (tempBasal.rate_type == 'percent') {
              var percent = 100 + tempBasal.rate_percent;
              var value = profileBasal * (percent / 100);
              return {
                  text: percent + '% (' + _roundBasal(value) + ' U/h)',
                  recency: Math.round((new Date() - tempBasal.start) / 1000),
              };
          } else {
              var diff = tempBasal.rate - profileBasal;
              return {
                  text: _roundBasal(tempBasal.rate) + ' U/h ' + (diff >= 0 ? '+' : '') + _roundBasal(diff),
                  recency: Math.round((new Date() - tempBasal.start) / 1000),
              };
          }

      } else {
        return {
          text: _roundBasal(profileBasal) + ' U/h',
          recency: 0
        };
      }
    });
  };

  d.getLoopStatus = function(config) {
    var fetchEnacted = config.statusLoopFormat.match(/temprate/i);
    var fetchBattery = config.statusLoopFormat.match(/(pumpbat|pumpvoltage|reservoir|phonebat)/i);
    var fetches = [
      d.getLastLoopStatus(config),
      fetchEnacted ? d.getLastLoopEnacted(config) : Promise.resolve([]),
      fetchBattery ? d.getLastUploaderBattery(config) : Promise.resolve([]),
    ];
    return Promise.all(fetches).then(function(results) {
      var loop = results[0][0]['loop'],
        createdAtEpoch = new Date(results[0][0]['created_at']).getTime(),
        enacted = results[1][0],
        battery = results[2][0];

      var props = {};

      if (loop['predicted'] && loop['predicted']['values'] && loop['predicted']['values'].length) {
        props.evbg = Math.round(loop['predicted']['values'][loop['predicted']['values'].length - 1]);
      }

      if (loop['iob'] && loop['iob']['iob'] !== undefined) {
        props.iob = roundOrZero(loop['iob']['iob']);
      }

      if (loop['cob'] && loop['cob']['cob'] !== undefined) {
        props.cob = Math.round(loop['cob']['cob']);
      }

      if (enacted && enacted['loop']['enacted']['duration'] && enacted['loop']['enacted']['rate'] !== undefined) {
        var endTimeEpoch = new Date(enacted['loop']['enacted']['timestamp']).getTime() + enacted['loop']['enacted']['duration'] * 60 * 1000;
        if (createdAtEpoch < endTimeEpoch) {
          props.temprate = enacted['loop']['enacted']['rate'];
        }
      }

      if (battery && Math.abs(createdAtEpoch - new Date(battery['created_at']).getTime()) <= 20 * 60 * 1000) {
        // show battery only from within 20 minutes of loop status
        if (battery['pump'] && battery['pump']['battery'] && battery['pump']['battery']['voltage'] !== undefined) {
          props.pumpvoltage = battery['pump']['battery']['voltage'];
        }

        if (battery['pump'] && battery['pump']['battery'] && battery['pump']['battery']['percent'] !== undefined) {
          props.pumpbat = battery['pump']['battery']['percent'];
        }

        if (battery['pump'] && battery['pump']['reservoir'] !== undefined) {
          props.reservoir = Math.round(battery['pump']['reservoir']);
        }

        if (battery['uploader'] && battery['uploader']['battery']) {
          props.phonebat = battery['uploader']['battery'];
        }
      }

      return {
        text: statusFormatters.formatLoopStatus(props, config.statusLoopFormat, config.mmol),
        recency: Math.round((Date.now() - createdAtEpoch) / 1000),
      };
    });
  };

  function roundOrZero(x) {
    if (x === 0 || x.toFixed(1) === '-0.0') {
      return '0';
    } else {
      return x.toFixed(1);
    }
  }

  function addPlus(str) {
    return (parseFloat(str) >= 0 ? '+' : '') + str;
  }

  function ago(ms) {
    var minutes = Math.round(ms / (60 * 1000));
    if (minutes < 60) {
      return minutes + 'm';
    } else {
      return Math.floor(minutes / 60) + 'h' + (minutes % 60);
    }
  }

  function openAPSIsFresh(entries, key) {
    var last = entries[0];
    var secondToLast = entries[1];
    var value = last['openaps'][key];
    if (value instanceof Array && value.length > 0) {
      value = value[0];
    }
    // for iob from oref0 with AMA, instead of timestamp the field is currently time
    var timestamp = value && (value['timestamp'] || value['time']);
    return (
      secondToLast &&
      value &&
      (
        !secondToLast['openaps'][key] ||
        new Date(timestamp) > new Date(secondToLast['created_at'])
      )
    );
  }

  function openAPSIsSuccess(entries) {
    return openAPSIsFresh(entries, 'suggested');
  }

  function openAPSEntriesFromLastSuccessfulDevice(allEntries) {
    var entriesByDevice = allEntries.reduce(function(acc, entry) {
      if (entry['device'] in acc) {
        acc[entry['device']].push(entry);
      } else {
        acc[entry['device']] = [entry];
      }
      return acc;
    }, {});

    var mostRecentSuccess;
    Object.keys(entriesByDevice).forEach(function(device) {
      entriesByDevice[device].forEach(function(entry, i, entries) {
        if (openAPSIsSuccess(entries.slice(i))) {
          if (mostRecentSuccess === undefined) {
            mostRecentSuccess = entry;
          } else {
            mostRecentSuccess = new Date(mostRecentSuccess['created_at']) > new Date(entry['created_at']) ? mostRecentSuccess : entry;
          }
        }
      });
    });

    if (mostRecentSuccess !== undefined) {
      return entriesByDevice[mostRecentSuccess['device']];
    } else if (allEntries.length > 0) {
      return entriesByDevice[allEntries[0]['device']];
    } else {
      return [];
    }
  }

  function openAPSTempBasal(entries, lastTemp, relativeTo, atTime) {
    var last = entries[0];
    var enacted = last['openaps']['enacted'];

    var rate;
    var remaining;
    if (
        openAPSIsFresh(entries, 'enacted') &&
        enacted['rate'] !== undefined && enacted['duration'] !== undefined &&
        (enacted['recieved'] === true || enacted['received'] === true)
    ) {
      // if last enacted is a "cancel", don't show an active rate and don't consider last temp basal
      if (enacted['duration'] > 0) {
        rate = enacted['rate'];
        remaining = Math.ceil(enacted['duration']);
      }
    } else if (lastTemp && lastTemp.duration > 0) {
      rate = lastTemp.rate;
      remaining = Math.ceil(lastTemp.duration - (new Date(atTime).getTime() - lastTemp.start) / (60 * 1000));
    }

    if (rate !== undefined && remaining > 0) {
      var rateDisplay = relativeTo !== undefined ? addPlus(roundOrZero(rate - relativeTo)) : roundOrZero(rate);
      return rateDisplay + 'x' + remaining;
    } else {
      return '';
    }
  }

  function openAPSIOB(entries) {
    var iob = entries[0]['openaps']['iob'];

    //iob from OpenAPS with AMA is an array
    if (iob instanceof Array && iob.length > 0) {
      iob = iob[0];
    }
    if (openAPSIsFresh(entries, 'iob') && iob['iob'] !== undefined) {
      return roundOrZero(iob['iob']) + 'U';
    } else {
      return '';
    }
  }

  function openAPSEventualBG(entries) {
    var suggested = entries[0]['openaps']['suggested'];
    if (openAPSIsFresh(entries, 'suggested') && suggested['eventualBG'] !== undefined) {
      return suggested['eventualBG'];
    }
  }

  function openAPSEventualBGDisplay(config, entries, abbreviate) {
    if (config.statusOpenAPSEvBG) {
      var evBG = openAPSEventualBG(entries);
      if (evBG !== undefined) {
        // If showing temp, eventual BG, and net +/-, we need all the space we can get
        evBG = config.mmol ? (evBG / 18.0).toFixed(1) : evBG;
        return (abbreviate ? '>' : '->') + evBG;
      }
    }
    return '';
  }

  function openAPSLastSuccess(config, entries, lastLoopTime) {
    for (var i = 0; i < entries.length; i++) {
      if (openAPSIsSuccess(entries.slice(i))) {
        var success = entries.slice(i);
        var iob = openAPSIOB(success);
        var evBG = openAPSEventualBGDisplay(config, success, false);
        var lastSuccessTime = openAPSLoopTime(success);
        var recency = ago(lastLoopTime - lastSuccessTime);
        var recencyDisplay = config.statusOpenAPSEvBG ? '+' + recency + ':' : '(+' + recency + ')';
        return recencyDisplay + ' ' + iob + evBG;
      }
    }
  }

  function openAPSLoopTime(entries) {
    var last = entries[0];

    var latest;
    if (openAPSIsFresh(entries, 'enacted')) {
      latest = last['openaps']['enacted']['timestamp'];
    } else if (openAPSIsFresh(entries, 'suggested')) {
      latest = last['openaps']['suggested']['timestamp'];
    } else {
      latest = last['created_at'];
    }
    return new Date(latest).getTime();
  }

  d.getOpenAPSStatus = function(config) {
    return Promise.all([
      d.getOpenAPSStatusHistory(config),
      _getLastTempBasal(config),
      _getCurrentProfileBasal(config),
    ]).then(function(results) {
      var allEntries = results[0],
        lastTemp = results[1],
        profileBasal = results[2];

      var entries = openAPSEntriesFromLastSuccessfulDevice(allEntries);
      if (entries.length < 2) {
        return {text: '-'};
      }

      var lastLoopTime = openAPSLoopTime(entries);

      var summary;
      if (openAPSIsSuccess(entries)) {
        var relativeTo = config.statusOpenAPSNetBasal ? profileBasal : undefined;
        var temp = openAPSTempBasal(entries, lastTemp, relativeTo, lastLoopTime);
        var iob = openAPSIOB(entries);
        // If showing temp, eventual BG, and net +/-, we need all the space we can get
        var abbreviate = temp !== '' && config.statusOpenAPSNetBasal;
        var evBG = openAPSEventualBGDisplay(config, entries, abbreviate);
        summary = iob + evBG + (temp !== '' ? ' ' + temp : '');
      } else {
        var lastSuccess = openAPSLastSuccess(config, entries, lastLoopTime);
        summary = '--' + (lastSuccess ? ' | ' + lastSuccess : '');
      }

      return {
        text: summary,
        recency: Math.round((Date.now() - lastLoopTime) / 1000),
      };
    });
  };

  d.getMultiple = function(config) {
    var fetches = [config.statusLine1, config.statusLine2, config.statusLine3].filter(function(key) {
      return key !== 'none';
    }).map(function(key) {
      return statusFn(key)(config).catch(function(e) {
        console.log(e.stack);
        return {text: '-'};
      });
    });
    return Promise.all(fetches).then(function(lines) {
      return {
        text: lines.map(function(l) { return l.text; }).join('\n').substr(0, 255),
        recency: lines[0].recency,
      };
    });
  };

  d.getStatusDate = function(config) {
    var format = config.statusDateFormat === 'custom' ? config.statusDateCustomFormat : config.statusDateFormat;
    return Promise.resolve({text: statusFormatters.formatDate(format)});
  };

  d.getNone = function() {
    return Promise.resolve({text: ''});
  };

  function statusFn(key) {
    var defaultFn = d.getNone;
    return {
      'none': d.getNone,
      'date': d.getStatusDate,
      'rigbattery': d.getRigBatteryLevel,
      'rawdata': d.getRawData,
      'rig-raw': d.getRigBatteryAndRawData,
      'basal': d.getActiveBasal,
      'pebbleiob': d.getPebbleIOB,
      'pebbleiobandcob': d.getPebbleIOBAndCOB,
      'loop': d.getLoopStatus,
      'openaps': d.getOpenAPSStatus,
      'customurl': d.getCustomUrl,
      'customjson': d.getCustomJsonUrl,
      'customtext': d.getCustomText,
      'multiple': d.getMultiple,
    }[key] || defaultFn;
  }

  d.getStatusText = function(config) {
    return statusFn(config.statusContent)(config);
  };

  d.getSGVsDateDescending = function(config) {
    if (config.dataSource === 'dexcom') {
      return d.getShareSGVsDateDescending(config);
    } else {
      return d.getNightscoutSGVsDateDescending(config);
    }
  };

  function filterKeys(objs, keys) {
    if (keys !== undefined) {
      return objs.map(function(obj) {
        return keys.reduce(function(acc, key) {
          if (obj[key] !== undefined) {
            acc[key] = obj[key];
          }
          return acc;
        }, {});
      });
    } else {
      return objs;
    }
  }

  function getUsingCache(baseUrl, cache, dateKey, keysToKeep) {
    var url = baseUrl;
    if (cache.entries.length) {
      url += '&find[' + dateKey + '][$gt]=' + encodeURIComponent(cache.entries[0][dateKey]);
    }
    return d.getJSON(url).then(function(newEntries) {
      return cache.update(filterKeys(newEntries, keysToKeep));
    });
  }

  d.getNightscoutSGVsDateDescending = debounce(function(config) {
    var start;
    if (sgvCache.entries.length) {
      start = sgvCache.entries[0]['date'];
    } else {
      start = new Date() - sgvCache.maxSecondsOld * 1000;
    }
    var url = config.nightscout_url + '/api/v1/entries/sgv.json?count=1000&find[date][$gt]=' + start;
    return d.getJSON(url).then(function(newEntries) {
      return sgvCache.update(
        filterKeys(newEntries, ['date', 'sgv', 'trend', 'direction', 'filtered', 'unfiltered', 'noise'])
      );
    });
  });

  d.getTempBasals = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/treatments.json?find[eventType]=Temp+Basal&count=' + tempBasalCache.maxSize,
      tempBasalCache,
      'created_at',
      ['created_at', 'duration', 'absolute', 'percent']
    );
  });

  d.getLastUploaderBattery = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/devicestatus.json?find[$or][0][uploaderBattery][$exists]=true&find[$or][1][uploader][$exists]=true&count=' + uploaderBatteryCache.maxSize,
      uploaderBatteryCache,
      'created_at'
    );
  });

  d.getLastCalibration = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/entries/cal.json?count=' + calibrationCache.maxSize,
      calibrationCache,
      'date'
    );
  });

  d.getBolusHistory = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/treatments.json?find[insulin][$exists]=true&count=' + bolusCache.maxSize,
      bolusCache,
      'created_at',
      ['created_at', 'insulin']
    );
  });

  d.getOpenAPSStatusHistory = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/devicestatus.json?find[openaps][$exists]=true&count=' + openAPSStatusCache.maxSize,
      openAPSStatusCache,
      'created_at'
    );
  });

  d.getLastLoopStatus = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/devicestatus.json?find[loop][$exists]=true&find[loop.failureReason][$not][$exists]=true&count=' + loopStatusCache.maxSize,
      loopStatusCache,
      'created_at'
    );
  });

  d.getLastLoopEnacted = debounce(function(config) {
    return getUsingCache(
      config.nightscout_url + '/api/v1/devicestatus.json?find[loop.enacted][$exists]=true&count=' + loopEnactedCache.maxSize,
      loopEnactedCache,
      'created_at'
    );
  });

  d.getProfile = function(config) {
    // Data from the profile.json endpoint has no notion of "modified at", so
    // we can't use a date to invalidate a cache as above. But the profile
    // changes so infrequently that we can simply request it once per app load.
    // (If the user updates their profile, they should restart the watchface.)
    if (profileCache === undefined) {
      profileCache = d.getJSON(config.nightscout_url + '/api/v1/profile.json');
    }
    return profileCache;
  };

  function _hhmmAfter(hhmm, mills) {
    var date = new Date(mills);
    var withSameDate = new Date(
      1900 + date.getYear(),
      date.getMonth(),
      date.getDate(),
      parseInt(hhmm.substr(0, 2), 10),
      parseInt(hhmm.substr(3, 5), 10)
    ).getTime();
    return withSameDate > date ? withSameDate : withSameDate + 24 * 60 * 60 * 1000;
  }

  function _profileBasalsInWindow(basals, start, end) {
    if (basals.length === 0) {
      return [];
    }

    var i;
    var out = [];
    function nextProfileBasal() {
      i = (i + 1) % basals.length;
      var lastStart = out[out.length - 1].start;
      return {
        start: _hhmmAfter(basals[i]['time'], lastStart),
        absolute: parseFloat(basals[i]['value']),
      };
    }

    i = 0;
    var startHHMM = new Date(start).toTimeString().substr(0, 5);
    while(i < basals.length - 1 && basals[i + 1]['time'] <= startHHMM) {
      i++;
    }
    out.push({
      start: start,
      absolute: parseFloat(basals[i]['value']),
    });

    var next = nextProfileBasal();
    while(next.start < end) {
      out.push(next);
      next = nextProfileBasal();
    }

    return out;
  }

  d.getBasalHistory = function(config) {
    return Promise.all([
      d.getProfile(config),
      d.getTempBasals(config),
    ]).then(function(results) {
      var profileBasals = _basalsFromProfile(results[0]);
      var temps = results[1].map(function(temp) {
        return {
          start: new Date(temp['created_at']).getTime(),
          duration: temp['duration'] === undefined ? 0 : parseInt(temp['duration'], 10) * 60 * 1000,
          absolute: temp['absolute'] === undefined ? 0 : parseFloat(temp['absolute']),
        };
      }).concat([
        {
          start: Date.now() - 24 * 60 * 60 * 1000,
          duration: 0,
        },
        {
          start: Date.now(),
          duration: 0,
        },
      ]).sort(function(a, b) {
        return a.start - b.start;
      });

      var out = [];
      temps.forEach(function(temp) {
        var last = out[out.length - 1];
        if (last && last.duration !== undefined && last.start + last.duration < temp.start) {
          Array.prototype.push.apply(out, _profileBasalsInWindow(profileBasals, last.start + last.duration, temp.start));
        }
        out.push(temp);
      });
      return out;
    });
  };

  d.getLoopPredictedBGs = function(config) {
    return d.getLastLoopStatus(config).then(function(statuses) {
      if (statuses.length === 0 || statuses[0]['loop']['predicted'] === undefined) {
        return {};
      } else {
        return {
          series: [statuses[0]['loop']['predicted']['values']],
          startDate: new Date(statuses[0]['loop']['predicted']['startDate']).getTime(),
        };
      }
    });
  };

  d.getOpenAPSPredictedBGs = function(config) {
    return d.getOpenAPSStatusHistory(config).then(function(history) {
      var lastSuggested;
      var lastEnacted;
      var lastPredicted;
      var entries = openAPSEntriesFromLastSuccessfulDevice(history);
      for (var i = 0; i < entries.length; i++) {
        lastSuggested = entries[i]['openaps']['suggested'];
        lastEnacted = entries[i]['openaps']['enacted'];

        if (lastSuggested || lastEnacted) {
          break;
        }
      }

      if (lastEnacted && lastSuggested) {
        var enactedTimestamp = lastEnacted['timestamp'] || lastEnacted['time'];
        var suggestedTimestamp = lastSuggested['timestamp'] || lastEnacted['time'];
        if (enactedTimestamp >= suggestedTimestamp) {
          lastPredicted = lastEnacted;
        } else {
          lastPredicted = lastSuggested;
        }
      } else if (lastEnacted) {
        lastPredicted = lastEnacted;
      } else if (lastSuggested) {
        lastPredicted = lastSuggested;
      }

      if (lastPredicted && lastPredicted['predBGs']) {
        var series = [
          lastPredicted['predBGs']['IOB'],
          lastPredicted['predBGs']['COB'],
          lastPredicted['predBGs']['aCOB'],
        ].filter(function(s) {
          return s !== undefined;
        });
        return {
          series: series,
          startDate: new Date(lastPredicted['timestamp']).getTime(),
        };
      } else {
        return {};
      }
    });
  };

  d.getPredictedBGs = function(config) {
    if (config.predictSource === 'loop') {
      return d.getLoopPredictedBGs(config);
    } else if (config.predictSource === 'openaps') {
      return d.getOpenAPSPredictedBGs(config);
    }
  };

  d.getShareSGVsDateDescending = function(config) {
    var sgvs;
    if (dexcomToken === undefined) {
      sgvs = d.getDexcomToken(config).then(d.requestDexcomSGVs.bind(this, config));
    } else {
      sgvs = d.requestDexcomSGVs(config, dexcomToken)
        .then(d.assertTokenStillValid)
        .catch(function(e) {
          console.log('Requesting new Dexcom token: ' + e);
          dexcomToken = undefined;
          return d.getDexcomToken(config).then(d.requestDexcomSGVs.bind(this, config));
        });
    }
    return sgvs
      .then(d.convertShareSGVs)
      .then(function(sgvs) {
        var newSGVs = sgvs.filter(function(sgv) {
          return sgvCache.entries.length === 0 || sgv['date'] > sgvCache.entries[0]['date'];
        });
        return sgvCache.update(newSGVs);
      });
  };

  d.getDexcomToken = function(config) {
    if (dexcomToken !== undefined) {
      return Promise.resolve(dexcomToken);
    } else {
      return d.postJSON(
        DEXCOM_SERVER + DEXCOM_LOGIN_PATH,
        DEXCOM_HEADERS,
        {
          'applicationId': DEXCOM_APPLICATION_ID,
          'accountName': config.dexcomUsername,
          'password': config.dexcomPassword,
        }
      ).then(function(token) {
        dexcomToken = token;
        return token;
      });
    }
  };

  d.assertTokenStillValid = function(response) {
    if (response['Code'] === 'SessionNotValid') {
      throw new Error(JSON.stringify(response));
    } else {
      return response;
    }
  };

  d.requestDexcomSGVs = function(config, token) {
    var count;
    if (sgvCache.entries.length) {
      var elapsed = Date.now() - sgvCache.entries[0]['date'];
      count = Math.min(maxSGVCount, Math.max(1, Math.floor(elapsed / (5 * 60 * 1000))));
    } else {
      count = maxSGVCount;
    }
    var url = [
      DEXCOM_SERVER,
      DEXCOM_LATEST_GLUCOSE_PATH,
      '?sessionId=' + token,
      '&minutes=' + 1440,
      '&maxCount=' + count,
    ].join('');
    return d.postJSON(url, DEXCOM_HEADERS);
  };

  d.convertShareSGVs = function(sgvs) {
    return sgvs.map(function(sgv) {
      // {"Trend":4, "Value":128, "WT":"/Date(1462404576000)/"}
      return {
        'sgv': sgv['Value'],
        'trend': sgv['Trend'],
        'date': parseInt(sgv['WT'].match(/\((.*)\)/)[1], 10),
      };
    });
  };

  return d;
};

module.exports = data;
