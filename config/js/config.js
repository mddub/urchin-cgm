/* jshint browser: true */
/* global Zepto, CONSTANTS, ga */

(function($, c) {

  var points = window.points(c);

  var MAIN_SLIDER_KEYS = [
    'topOfGraph',
    'topOfRange',
    'bottomOfRange',
    'bottomOfGraph',
    'statusRawCount',
    'basalHeight',
  ];

  var POINT_SLIDER_KEYS = [
    'pointRectHeight',
    'pointWidth',
    'pointMargin',
    'pointRightMargin',
    'plotLineWidth',
  ];

  var customLayout;
  var currentLayoutChoice;

  // On the phone, this string is substituted by the app JS.
  // On the emulator, it's provided in the query string by pebble-tool.
  var returnTo = getQueryParam('return_to') || '$$RETURN_TO$$';

  var watchInfo = {};
  try {
    watchInfo = JSON.parse(decodeURIComponent('$$WATCH_INFO$$'));
  } catch (e) {
    watchInfo = JSON.parse(getQueryParam('watchInfo', '{}'));
  }
  // Older versions of Urchin pass these as separate query params
  watchInfo.version = watchInfo.version || getQueryParam('version');
  watchInfo.pf = watchInfo.pf || getQueryParam('pf');
  watchInfo.fw = watchInfo.fw || getQueryParam('fw');
  watchInfo.at = watchInfo.at || getQueryParam('at');
  watchInfo.wt = watchInfo.wt || getQueryParam('wt');

  var phoneConfig = {};
  try {
    phoneConfig = JSON.parse(decodeURIComponent('$$CURRENT$$'));
  } catch (e) {
    phoneConfig = JSON.parse(getQueryParam('current', '{}'));
  }

  function upgradeConfig(config) {
    if (config.layout === undefined) {
      // v0.0.4
      config.layout = 'a';
    }
    if (config.statusContent === 'careportaliob' || config.statusContent === 'pumpiob') {
      // v0.0.11: IOB from /pebble now handles both Care Portal and devicestatus IOB
      config.statusContent = 'pebbleiob';
    }
    // v0.0.12: new layout properties
    if (config.customLayout) {
      config.customLayout.connStatusLoc = config.customLayout.connStatusLoc || c.DEFAULT_CONFIG.customLayout.connStatusLoc;
      config.customLayout.recencyLoc = config.customLayout.recencyLoc || c.DEFAULT_CONFIG.customLayout.recencyLoc;
      config.customLayout.recencyStyle = config.customLayout.recencyStyle || c.DEFAULT_CONFIG.customLayout.recencyStyle;
      config.customLayout.recencyColorCircle = config.customLayout.recencyColorCircle || c.DEFAULT_CONFIG.customLayout.recencyColorCircle;
      config.customLayout.recencyColorText = config.customLayout.recencyColorText || c.DEFAULT_CONFIG.customLayout.recencyColorText;
    }

    return config;
  }

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

  function tryParseInt(s, defaultValue) {
    return isNaN(parseInt(s, 10)) ? defaultValue : parseInt(s, 10);
  }

  function enabledLayoutElements() {
    return $('.layout-order label').toArray().filter(function(e) {
      return $(e).find(':checked').length > 0;
    }).map(function(e) {
      return $(e).data('element');
    });
  }

  function layoutElementDistance(a, b) {
    var order = $('.layout-order label').toArray().map(function(e) {
      return $(e).data('element');
    });
    return order.indexOf(a) - order.indexOf(b);
  }

  function onPointStyleClick(e) {
    var key = $(e.currentTarget).attr('value');
    var style = c.POINT_STYLES[key];
    if (key === 'd' && points.computeGraphWidth(encodeLayout()) !== 144) {
      // XXX adapt this style to narrow graph, but only when first selected
      style.pointRightMargin = 2;
    }
    if (style !== undefined) {
      populatePointConfig(style);
      setTimeout(onPointSettingsChange.bind(this, false), 0);
    }
  }

  function updateSelectedPointStyle() {
    var selected = {};
    encodePointConfig(selected);
    var match = Object.keys(c.POINT_STYLES).filter(function(styleKey) {
      var style = c.POINT_STYLES[styleKey];
      var keys = Object.keys(style).slice();
      if (!style.plotLine) {
        keys = keys.filter(function(k) { return k !== 'plotLineWidth'; });
      }
      if (style.pointShape === 'circle') {
        keys = keys.filter(function(k) { return k !== 'pointRectHeight'; });
      }
      if (styleKey === 'd') {
        // XXX see onPointStyleClick
        keys = keys.filter(function(k) { return k !== 'pointRightMargin'; });
      }
      return keys.reduce(function(equal, key) {
        return equal && style[key] === selected[key];
      }, true);
    })[0] || 'custom';
    $('[name=pointStyle]').removeClass('active');
    $('[name=pointStyle][value=' + match + ']').addClass('active');
  }

  function onPointSettingsChange(e) {
    if ($('[name=pointShape].active').attr('value') === 'circle') {
      $('.point-width-container .item-container-header').text('Point diameter');
      $('#pointWidth').attr('step', 2);
      $('.point-height-container').hide();
    } else {
      $('.point-width-container .item-container-header').text('Point width');
      $('#pointWidth').attr('step', 1);
      $('.point-height-container').show();
    }

    $('.plot-line-width-container').toggle($('#plotLine').is(':checked'));

    var width = tryParseInt($('#pointWidth-val').val(), 1);
    var height = tryParseInt($('#pointRectHeight-val').val(), 1);

    // point width must be odd for circle
    if ($('[name=pointShape].active').attr('value') === 'circle' && width % 2 === 0) {
      $('#pointWidth, #pointWidth-val').val(width + 1);
    }

    // point height must be odd
    if (height % 2 === 0) {
      $('#pointRectHeight, #pointRectHeight-val').val(height + 1);
    }

    // the lowest available negative point margin must make sense
    var minMargin = 1 - width;
    if (tryParseInt($('#pointMargin').val(), 0) < minMargin) {
      $('#pointMargin, #pointMargin-val').val(minMargin);
    }
    $('#pointMargin').attr('min', minMargin);

    // line width must be odd
    var lineWidth = tryParseInt($('#plotLineWidth-val').val(), 1);
    if (lineWidth % 2 === 0) {
      $('#plotLineWidth, #plotLineWidth-val').val(lineWidth - 1);
    }

    $('.plot-line-is-custom-color-container').toggle($('#plotLine').is(':checked'));
    $('.plot-line-color-container').toggle(
      $('#plotLine').is(':checked') && $('[name=plotLineIsCustomColor]').val() === 'true'
    );

    updateVisibleHistoryLength();

    if (e) {
      updateSelectedPointStyle();
    }
  }

  function updateVisibleHistoryLength() {
    var graphWidth = points.computeGraphWidth(encodeLayout());
    var pointCount = points.computeVisiblePoints(graphWidth, buildConfig());
    var hours = Math.floor(pointCount / 12);
    var minutes = (pointCount - (12 * hours)) * 5;
    var text;
    if (hours > 0 && minutes > 0) {
      text = hours + ' hr ' + minutes + ' min';
    } else if (hours > 0 && minutes === 0) {
      text = hours + ' hour' + (hours > 1 ? 's' : '');
    } else {
      text = minutes + ' minutes';
    }
    $('.history-length-shown').text(text);
    $('.current-layout-graph-width').text(graphWidth);
  }

  function toggleAdvancedLayout() {
    $('.advanced-layout').toggle($('[name=advancedLayout]').is(':checked'));
  }

  function onLayoutUpDownButtonClick(evt) {
    evt.preventDefault();

    var $button = $(evt.currentTarget);
    if ($button.hasClass('disabled')) {
      return;
    }

    var $label = $button.closest('label');
    if ($button.hasClass('up')) {
      $label.insertBefore($label.prev());
    } else if($button.hasClass('down')) {
      $label.insertAfter($label.next());
    }

    // ensure graph and sidebar are adjacent
    var distance = layoutElementDistance('GRAPH_ELEMENT', 'SIDEBAR_ELEMENT');
    if (Math.abs(distance) > 1) {
      var $graph = $('.layout-order [data-element=GRAPH_ELEMENT]');
      var $sidebar = $('.layout-order [data-element=SIDEBAR_ELEMENT]');
      if ($label[0] === $graph[0]) {
        if (distance < 0) {
          $sidebar.insertAfter($graph);
        } else {
          $sidebar.insertBefore($graph);
        }
      } else if ($label[0] === $sidebar[0]) {
        if (distance < 0) {
          $graph.insertBefore($sidebar);
        } else {
          $graph.insertAfter($sidebar);
        }
      }
    }
  }

  function updateLayoutUpDownEnabledState() {
    var labels = $('.layout-order label').toArray();
    labels.forEach(function(label, i) {
      $(label).find('.button').removeClass('disabled');
      if (i === 0) {
        $(label).find('.up').addClass('disabled');
      }
      if (i === labels.length - 1) {
        $(label).find('.down').addClass('disabled');
      }
    });
  }

  function reorderLayoutInputs() {
    var enabled = enabledLayoutElements();
    [
      $('.layout-height'),
      $('.layout-element-config'),
    ].forEach(function(list) {
      c.ELEMENTS.forEach(function(element) {
        list.find('[data-element=' + element + ']').toggle(enabled.indexOf(element) !== -1);
      });
      enabled.forEach(function(element) {
        list.find('[data-element=' + element + ']').appendTo(list);
      });
    });
  }

  function assignWidths(elements) {
    // XXX: assign width of 100% to everything, unless both graph and sidebar
    // are enabled, in which case they get width 75% and 25%.
    // TODO: make widths user-configurable... maybe.
    var graphAndSidebarEnabled = elements.filter(function(e) {
      return e['enabled'];
    }).filter(function(e) {
      return c.ELEMENTS[e['el']] === 'GRAPH_ELEMENT' || c.ELEMENTS[e['el']] === 'SIDEBAR_ELEMENT';
    }).length === 2;

    elements.forEach(function(e) {
      if (c.ELEMENTS[e['el']] === 'GRAPH_ELEMENT' && graphAndSidebarEnabled) {
        e.width = 75;
      } else if (c.ELEMENTS[e['el']] === 'SIDEBAR_ELEMENT' && graphAndSidebarEnabled) {
        e.width = 25;
      } else {
        e.width = 100;
      }
    });

    return elements;
  }

  function encodeLayout() {
    var elements = $('.layout-order label').toArray().map(function(e) {
      var elName = $(e).data('element');
      return {
        el: c.ELEMENTS.indexOf(elName),
        enabled: $(e).find(':checked').length > 0,
        height: Math.min(255, parseInt($('.layout-height [data-element=' + elName + '] input').val(), 10)),
        black: $('.layout-element-config [data-element=' + elName + '] [name=black]').is(':checked'),
        bottom: $('.layout-element-config [data-element=' + elName + '] [name=bottom]').is(':checked'),
        right: $('.layout-element-config [data-element=' + elName + '] [name=right]').is(':checked'),
      };
    });

    elements = assignWidths(elements);

    var out = {
      elements: elements,
      batteryLoc: $('#batteryLoc').val(),
      timeAlign: $('#timeAlign').val(),
      connStatusLoc: $('#connStatusLoc').val(),
      recencyLoc: $('#recencyLoc').val(),
      recencyStyle: $('[name=recencyStyle].active').attr('value'),
    };
    encodeLayoutColors(out);
    return out;
  }

  function decodeLayout(layoutKey) {
    var layout = (layoutKey === 'custom' ? customLayout : c.LAYOUTS[layoutKey]);
    layout.elements.forEach(function(elementConfig) {
      var elName = c.ELEMENTS[elementConfig['el']];

      // decode ordering
      var $orderLabel = $('.layout-order').find('[data-element=' + elName + ']');
      $orderLabel.appendTo($('.layout-order'));

      // decode values
      $('.layout-order [data-element=' + elName + '] [type=checkbox]')
        .prop('checked', elementConfig['enabled']);

      $('.layout-height [data-element=' + elName + '] input')
        .val(elementConfig['height'] || 0);

      [
        'black',
        'bottom',
        'right',
      ].forEach(function(propName) {
        $('.layout-element-config [data-element=' + elName + '] [name=' + propName + ']')
          .prop('checked', elementConfig[propName]);
      });
    });

    [
      'batteryLoc',
      'timeAlign',
      'recencyLoc',
      'connStatusLoc',
    ].forEach(function(prefKey) {
      $('[name=' + prefKey + ']').val(layout[prefKey]);
    });

    $('[name=recencyStyle]').removeClass('active');
    $('[name=recencyStyle][value=' + layout.recencyStyle + ']').addClass('active');

    toggleRecencySettings();
    populateColors(layout);
  }

  function showLayoutPreview(layout) {
    $('#layout-preview').removeClass(function(i, oldClass) { return oldClass; });
    $('#layout-preview').addClass('layout-preview-' + layout);
  }

  function onLayoutChoiceChange(e) {
    if (currentLayoutChoice === 'custom') {
      // if switching from custom to a preset, save the custom layout
      customLayout = encodeLayout();
    }
    currentLayoutChoice = (e ? $(e.currentTarget) : $('[name=layout].active')).attr('value');
    showLayoutPreview(currentLayoutChoice);
    decodeLayout(currentLayoutChoice);
    updateLayoutUpDownEnabledState();
    reorderLayoutInputs();
    updateVisibleHistoryLength();
    toggleRecencySettings();
  }

  function elementsEqual(a, b) {
    return Object.keys(a).reduce(function(equal, key) {
      return equal && a[key] === b[key];
    }, true);
  }

  function layoutsEqual(a, b) {
    // TODO use deep-equal + browserify instead of this brittle homebrew comparison
    return Object.keys(a).reduce(function(equal, key) {
      if (key === 'elements') {
        return equal && a['elements'].reduce(function(elEql, el, i) {
          return elEql && elementsEqual(el, b['elements'][i]);
        }, true);
      } else {
        return equal && JSON.stringify(a[key]) === JSON.stringify(b[key]);
      }
    }, true);
  }

  function deriveLayoutChoiceFromInputs() {
    var selected = encodeLayout();
    var match = Object.keys(c.LAYOUTS).filter(function(preset) {
      return layoutsEqual(c.LAYOUTS[preset], selected);
    })[0];
    return match !== undefined ? match : 'custom';
  }

  function updateSelectedLayout() {
    var layout = deriveLayoutChoiceFromInputs();
    if (layout !== $('[name=layout].active').attr('value')) {
      $('[name=layout]').removeClass('active');
      $('[name=layout][value=' + layout + ']').addClass('active');
      showLayoutPreview(layout);
    }
  }

  function toggleRecencySettings() {
    var recencyLoc = $('[name=recencyLoc]').val();
    var recencyStyle = $('[name=recencyStyle].active').attr('value');
    $('.recency-settings').toggle(recencyLoc !== 'none');
    $('.recency-color-circle').toggle(
      ['smallNoCircle', 'mediumNoCircle', 'largeNoCircle'].indexOf(recencyStyle) === -1
    );
  }

  function initializeStatusOptions(current) {
    createMultipleStatusLineOptions(current);
    $('#statusContent').on('change', toggleStatusExtraOptions);
    toggleStatusExtraOptions();

    $('[name=statusDateFormat] option').forEach(function(o) {
      var format = $(o).val();
      if (format !== 'custom') {
        $(o).text(window.statusFormatters.formatDate(format));
      }
    });
  }

  function createMultipleStatusLineOptions(current) {
    $('.status-line-option').each(function(i, el) {
      var $cloned = $('#main-status-option .item-container-content').clone().appendTo(el);
      var $select = $cloned.find('select');
      var fieldName = $(el).data('field');
      var selected = current[fieldName] === undefined ? 'none' : current[fieldName];
      $select.attr('id', fieldName);
      $select.find('[value=multiple]').remove();
      $select.find('[value=' + selected + ']').prop('selected', true);
      $select.on('change', toggleStatusExtraOptions);
    });
  }

  function toggleStatusExtraOptions() {
    var mainKey = $('#statusContent').val();
    var selected = [mainKey];
    if (mainKey === 'multiple') {
      selected = selected.concat($('#statusLine1, #statusLine2, #statusLine3').map(function(i, el) {
        return $(el).val();
      }));
    }
    $('.status-extra').each(function(i, el) {
      var keys = $(el).data('keys').split(' ');
      $(el).toggle(
        selected.reduce(function(acc, key) {
          return acc || keys.indexOf(key) !== -1;
        }, false)
      );
    });

    var showStatusRecencyOptions = ['none', 'date', 'rawdata', 'customurl', 'customtext'].indexOf(mainKey) === -1;
    $('.status-recency-options').toggle(showStatusRecencyOptions);
  }

  function onStatusDateFormatChange() {
    var format = $('[name=statusDateFormat]').val();
    if (format === 'custom') {
      $('.status-date-custom-format').show();
      $('.status-date-format-string').hide();
    } else {
      $('.status-date-custom-format').hide();
      $('.status-date-format-string').show().text(format);
    }
  }

  function onStatusDateCustomFormatChange() {
    $('.status-date-preview').text(
      window.statusFormatters.formatDate($('[name=statusDateCustomFormat]').val())
    );
  }

  function onStatusLoopFormatChange() {
    var sampleData = {evbg: 82, iob: 0.9, cob: 4, temprate: 0.15, pumpvoltage: 1.56, pumpbat: 75, reservoir: 102, phonebat: 64};
    var format = $('[name=statusLoopFormat]').val();
    var mmol = $('#units-mmol').hasClass('active');
    $('.status-loop-format-preview').text(
      window.statusFormatters.formatLoopStatus(sampleData, format, mmol).replace('\n', ' | ')
    );
  }

  function onTabClick(e) {
    e.preventDefault();
    var target = $(e.currentTarget).closest('li').data('target');
    $('.tab').hide();
    $('.tab#' + target).show();
    // keep the top/bottom tab menus in sync
    $('.tabs-menu li').removeClass('current');
    $('.tabs-menu li[data-target=' + target + ']').addClass('current');
    // keep the tab menu visible when content expands
    if ($(e.currentTarget).closest('.tabs-menu').hasClass('bottom')) {
      setTimeout(function() {
        window.scrollTo(0, document.body.scrollHeight);
      });
    }
  }

  function populateSliders(current, sliderKeys) {
    sliderKeys.forEach(function(key) {
      $('#' + key).val(current[key] !== undefined ? current[key] : '');
      $('#' + key + '-val').val(current[key] !== undefined ? current[key] : '');
    });
  }

  function encodeSliders(out, sliderKeys) {
    sliderKeys.forEach(function(key) {
      var val = tryParseInt($('#' + key + '-val').val(), 0);
      var $slider = $('#' + key);
      if ($slider.attr('max')) {
        val = Math.min(val, parseInt($slider.attr('max'), 10));
      }
      if ($slider.attr('min')) {
        val = Math.max(val, parseInt($slider.attr('min'), 10));
      }
      out[key] = val;
    });
  }

  function populatePointConfig(current) {
    populateSliders(current, POINT_SLIDER_KEYS.filter(function(k) { return k in current; }));
    $('[name=pointShape]').removeClass('active');
    $('[name=pointShape][value=' + current['pointShape'] + ']').addClass('active');
    $('#plotLine').prop('checked', !!current['plotLine']);
  }

  function encodePointConfig(out) {
    out.pointShape = $('[name=pointShape].active').attr('value');
    out.plotLine = $('#plotLine').is(':checked');
    encodeSliders(out, POINT_SLIDER_KEYS);
  }

  function populateColors(current) {
    c.COLOR_KEYS.forEach(function(key) {
      if (current[key]) {
        // the first one is needed for page load, before Slate JS has bound to the event
        $('[name=' + key + ']').val(current[key]);
        $('[name=' + key + ']').trigger('changeValue', [current[key]]);
      }
    });
  }

  function encodeNonLayoutColors(out) {
    c.COLOR_KEYS.filter(function(key) {
      return c.LAYOUT_COLOR_KEYS.indexOf(key) === -1;
    }).forEach(function(key) {
      out[key] = $('[name=' + key + ']').val();
    });
  }

  function encodeLayoutColors(out) {
    c.LAYOUT_COLOR_KEYS.forEach(function(key) {
      out[key] = $('[name=' + key + ']').val();
    });
  }

  function populateValues(current) {
    $('#ns-url').val(current['nightscout_url'] || '');

    if (current.mmol === true) {
      $('#units-mmol').addClass('active');
    } else {
      $('#units-mgdl').addClass('active');
    }

    populateSliders(current, MAIN_SLIDER_KEYS);
    populatePointConfig(current);
    populateColors(current);

    $('[name=plotLineIsCustomColor]').val(current['plotLineIsCustomColor'] ? 'true' : 'false');

    $('#hGridlines').val(current['hGridlines']);

    $('[name=statusDateFormat]').val(current['statusDateFormat']);
    $('[name=statusDateCustomFormat]').val(current['statusDateCustomFormat']);
    $('#statusContent').val(current['statusContent']);
    $('#statusText').val(current['statusText'] || '');
    $('#statusUrl').val(current['statusUrl'] || '');
    $('#statusJsonUrl').val(current['statusJsonUrl'] || '');
    $('[name=statusLoopFormat]').val(current['statusLoopFormat']);
    $('[name=statusOpenAPSNetBasal]').val(current['statusOpenAPSNetBasal'] ? 'true' : 'false');
    $('[name=statusOpenAPSEvBG]').prop('checked', !!current['statusOpenAPSEvBG']);
    $('[name=statusMinRecencyToShowMinutes]').val(current['statusMinRecencyToShowMinutes']);
    $('[name=statusMaxAgeMinutes]').val(current['statusMaxAgeMinutes']);
    $('[name=statusRecencyFormat]').val(current['statusRecencyFormat']);

    if (current.batteryAsNumber === true) {
      $('[name=batteryAsNumber][value=number]').addClass('active');
    } else {
      $('[name=batteryAsNumber][value=icon]').addClass('active');
    }

    $('[name=bolusTicks]').prop('checked', !!current['bolusTicks']);
    $('[name=basalGraph]').prop('checked', !!current['basalGraph']);

    $('[name=predictEnabled]').prop('checked', !!current['predictEnabled']);
    $('[name=predictSource]').val(current['predictSource']);
    $('[name=predictMaxLength]').val(current['predictMaxLength']);

    $('[name=updateEveryMinute]').val(current['updateEveryMinute'] ? 'true' : 'false');

    $('[name=layout][value=' + current.layout + ']').addClass('active');
    $('[name=advancedLayout]').prop('checked', !!current['advancedLayout']);

    customLayout = current['customLayout'];
    decodeLayout(current['layout']);
  }

  function buildConfig() {
    var layout = $('[name=layout].active').attr('value');
    if (layout === 'custom') {
      customLayout = encodeLayout();
    }
    var mmol = $('#units-mmol').hasClass('active');
    var out = {
      version: c.VERSION,
      mmol: mmol,
      nightscout_url: $('#ns-url').val().replace(/\/$/, ''),
      hGridlines: tryParseInt($('#hGridlines').val()),
      plotLineIsCustomColor: $('[name=plotLineIsCustomColor]').val() === 'true',
      statusContent: $('#statusContent').val(),
      statusDateFormat: $('[name=statusDateFormat]').val(),
      statusDateCustomFormat: $('[name=statusDateCustomFormat]').val(),
      statusText: $('#statusText').val(),
      statusUrl: $('#statusUrl').val(),
      statusJsonUrl: $('#statusJsonUrl').val(),
      statusLoopFormat: $('[name=statusLoopFormat]').val(),
      statusOpenAPSNetBasal: $('[name=statusOpenAPSNetBasal]').val() === 'true',
      statusOpenAPSEvBG: $('[name=statusOpenAPSEvBG]').is(':checked'),
      statusLine1: $('#statusLine1').val(),
      statusLine2: $('#statusLine2').val(),
      statusLine3: $('#statusLine3').val(),
      statusMinRecencyToShowMinutes: tryParseInt($('[name=statusMinRecencyToShowMinutes]').val()),
      statusMaxAgeMinutes: tryParseInt($('[name=statusMaxAgeMinutes]').val()),
      statusRecencyFormat: $('[name=statusRecencyFormat]').val(),
      batteryAsNumber: $('[name=batteryAsNumber][value=number]').hasClass('active'),
      bolusTicks: $('[name=bolusTicks]').is(':checked'),
      basalGraph: $('[name=basalGraph]').is(':checked'),
      predictEnabled: $('[name=predictEnabled]').is(':checked'),
      predictSource: $('[name=predictSource]').val(),
      predictMaxLength: tryParseInt($('[name=predictMaxLength]').val()),
      updateEveryMinute: $('[name=updateEveryMinute]').val() === 'true',
      layout: $('[name=layout].active').attr('value'),
      advancedLayout: $('[name=advancedLayout]').is(':checked'),
      customLayout: customLayout,
    };
    encodeSliders(out, MAIN_SLIDER_KEYS);
    encodePointConfig(out);
    encodeNonLayoutColors(out);
    return out;
  }

  function onSubmit(e) {
    e.preventDefault();
    document.location = returnTo + encodeURIComponent(JSON.stringify(buildConfig()));
  }

  // TODO remove this
  function trackGA() {
    // In older versions, this config page is hosted on the web, accessed in a
    // webview, and this page is responsible for GA tracking.
    // In v0.0.13 and later, Urchin ships with this config page as a data URI,
    // accessed offline, and the app JS is responsible for GA tracking.
    if (document.location.href.indexOf('https://mddub.github.io') === -1) {
      return;
    }

    /* jshint ignore:start */
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','//www.google-analytics.com/analytics.js','ga');
    /* jshint ignore:end */

    // redact PII
    var current = JSON.parse(JSON.stringify(phoneConfig));
    delete current['nightscout_url'];
    delete current['statusText'];
    delete current['statusUrl'];
    delete current['statusJsonUrl'];
    var cleansed = [
      ['version', watchInfo.version],
      ['pf', watchInfo.pf],
      ['fw', watchInfo.fw],
      ['at', watchInfo.at],
      ['wt', watchInfo.wt],
      ['current', JSON.stringify(current)],
    ].filter(function(pair) {
      return pair[1];
    }).map(function(pair) {
      return pair[0] + '=' + pair[1];
    }).join('&');

    ga('create', c.CONFIG_GA_ID, 'auto');
    ga('send', 'pageview', location.pathname + '?' + cleansed);
  }

  $(function() {

    var current = upgradeConfig(phoneConfig);
    populateValues(current);

    $('#update-available #running-version').text(watchInfo.version || '0.0.0');
    $('#update-available #available-version').text(c.VERSION);
    $('#update-available').toggle(c.VERSION !== watchInfo.version);

    $('.config-page-version').text('v' + c.VERSION);

    $('.color-platforms-only').toggle(['aplite', 'diorite'].indexOf(watchInfo.pf) === -1);

    initializeStatusOptions(current);

    $('[name=statusDateFormat]').on('change', onStatusDateFormatChange);
    onStatusDateFormatChange();
    $('[name=statusDateCustomFormat]').on('keyup', onStatusDateCustomFormatChange);
    onStatusDateCustomFormatChange();

    $('[name=statusLoopFormat]').on('keyup', onStatusLoopFormatChange);
    $('#units-mgdl, #units-mmol').on('click', setTimeout.bind(this, onStatusLoopFormatChange, 0));
    onStatusLoopFormatChange();

    $('#basalGraph').on('change', function(evt) {
      $('#basal-height-container').toggle($(evt.currentTarget).is(':checked'));
    });
    $('#basalGraph').trigger('change');

    $('[name=predictEnabled]').on('change', function(evt) {
      $('.prediction-setting').toggle($(evt.currentTarget).is(':checked'));
    });
    $('[name=predictEnabled]').trigger('change');

    $('[name=pointStyle]').on('click', onPointStyleClick);

    $('[name=pointShape]').on('click', setTimeout.bind(this, onPointSettingsChange, 0));
    $('#pointRectHeight, #pointRectHeight-val').on('change', onPointSettingsChange);
    $('#pointWidth, #pointWidth-val').on('change', onPointSettingsChange);
    $('#pointMargin, #pointMargin-val').on('change', onPointSettingsChange);
    $('#pointRightMargin, #pointRightMargin-val').on('change', onPointSettingsChange);
    $('#plotLine').on('change', onPointSettingsChange);
    $('#plotLineWidth, #plotLineWidth-val').on('change', onPointSettingsChange);
    $('[name=plotLineIsCustomColor]').on('change', onPointSettingsChange);
    onPointSettingsChange(true);

    $('.layout-order').children('label').append([
      '<div class="up-down-buttons">',
        '<a class="button up">&#9650;</a>',
        '<a class="button down">&#9660;</a>',
      '</div>'
    ].join(''));
    $('.up-down-buttons .button').on('click', function(evt) {
      onLayoutUpDownButtonClick(evt);
      updateLayoutUpDownEnabledState();
      reorderLayoutInputs();
      updateSelectedLayout();
    });

    $('.layout-order input').on('change', function() {
      updateLayoutUpDownEnabledState();
      reorderLayoutInputs();
      updateSelectedLayout();
      updateVisibleHistoryLength();
    });

    $('[name=advancedLayout]').on('change', toggleAdvancedLayout);
    toggleAdvancedLayout();

    var $graphHeight = $('.layout-height [data-element=GRAPH_ELEMENT] input');
    var $sidebarHeight = $('.layout-height [data-element=SIDEBAR_ELEMENT] input');
    $graphHeight.on('change', function() {
      $sidebarHeight.val($graphHeight.val());
    });

    $('[name=layout]').on('click', onLayoutChoiceChange);
    onLayoutChoiceChange();

    $([
      '.layout-order input',
      '.layout-height input',
      '.layout-element-config input',
      '[name=timeAlign]',
      '[name=batteryLoc]',
      '[name=recencyLoc]',
      '[name=connStatusLoc]',
    ].join(', ')).on('change', updateSelectedLayout);
    $('[name=recencyStyle]').on('click', function() {
      // wait until this option has the "active" class
      setTimeout(function() {
        updateSelectedLayout();
        toggleRecencySettings();
      }, 0);
    });
    c.LAYOUT_COLOR_KEYS.forEach(function(key) {
      $('[name=' + key + ']').on('colorChangedByClick', updateSelectedLayout);
    });

    $('[name=recencyLoc]').on('change', toggleRecencySettings);
    toggleRecencySettings();

    $('.tabs-menu a').on('click', onTabClick);

    $('#config-form').on('submit', onSubmit);

    trackGA();

  });
})(Zepto, CONSTANTS);
