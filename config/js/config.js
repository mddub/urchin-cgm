/* jshint browser: true */
/* global Zepto, CONSTANTS, ga */

(function($, c) {

  var SLIDER_KEYS = [
    'topOfGraph',
    'topOfRange',
    'bottomOfRange',
    'bottomOfGraph',
    'statusRawCount',
    'basalHeight',
  ];

  var customLayout;
  var currentLayoutChoice;

  function upgradeConfig(config) {
    if (config.layout === undefined) {
      // config is un-versioned and older than v0.0.4
      config.layout = 'a';
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
    return parseInt(s, 10) >= 0 ? parseInt(s, 10) : defaultValue;
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

    return {
      elements: elements,
      batteryLoc: document.getElementById('batteryLoc').value,
      timeAlign: document.getElementById('timeAlign').value,
    };
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
    ].forEach(function(prefKey) {
      $('[name=' + prefKey + ']').val(layout[prefKey]);
    });
  }

  function showLayoutPreview(layout) {
    $('#layout-preview').removeClass(function(i, oldClass) { return oldClass; });
    $('#layout-preview').addClass('layout-preview-' + layout);
  }

  function onLayoutChoiceChange() {
    if (currentLayoutChoice === 'custom') {
      // if switching from custom to a preset, save the custom layout
      customLayout = encodeLayout();
    }
    currentLayoutChoice = $('[name=layout].active').attr('value');
    showLayoutPreview(currentLayoutChoice);
    decodeLayout(currentLayoutChoice);
    updateLayoutUpDownEnabledState();
    reorderLayoutInputs();
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
        return a['elements'].reduce(function(equal, el, i) {
          return equal && elementsEqual(el, b['elements'][i]);
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

  function maybeUpdateSelectedLayout() {
    var layout = deriveLayoutChoiceFromInputs();
    if (layout !== $('[name=layout].active').attr('value')) {
      $('[name=layout]').removeClass('active');
      $('[name=layout][value=' + layout + ']').addClass('active');
      showLayoutPreview(layout);
    }
  }

  function populateValues(current) {
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
    document.getElementById('statusText').value = current['statusText'] || '';
    document.getElementById('statusUrl').value = current['statusUrl'] || '';

    if (current.batteryAsNumber === true) {
      $('[name=batteryAsNumber][value=number]').addClass('active');
    } else {
      $('[name=batteryAsNumber][value=icon]').addClass('active');
    }

    $('[name=bolusTicks]').prop('checked', !!current['bolusTicks']);
    $('[name=basalGraph]').prop('checked', !!current['basalGraph']);

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
    var mmol = document.getElementById('units-mgdl').className.indexOf('active') === -1;
    var out = {
      version: c.VERSION,
      mmol: mmol,
      nightscout_url: document.getElementById('ns-url').value.replace(/\/$/, ''),
      hGridlines: tryParseInt(document.getElementById('hGridlines').value),
      statusContent: document.getElementById('statusContent').value,
      statusText: document.getElementById('statusText').value,
      statusUrl: document.getElementById('statusUrl').value,
      batteryAsNumber: $('[name=batteryAsNumber][value=number]').hasClass('active'),
      bolusTicks: $('[name=bolusTicks]').is(':checked'),
      basalGraph: $('[name=basalGraph]').is(':checked'),
      updateEveryMinute: $('[name=updateEveryMinute]').val() === 'true',
      layout: $('[name=layout].active').attr('value'),
      advancedLayout: $('[name=advancedLayout]').is(':checked'),
      customLayout: customLayout,
    };
    SLIDER_KEYS.forEach(function(key) {
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
    return out;
  }

  function onSubmit(e) {
    e.preventDefault();
    document.location = getQueryParam('return_to', 'pebblejs://close#') + encodeURIComponent(JSON.stringify(buildConfig()));
  }

  function trackGA() {
    /* jshint ignore:start */
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','//www.google-analytics.com/analytics.js','ga');
    /* jshint ignore:end */

    // redact PII
    var current = JSON.parse(getQueryParam('current', '{}'));
    delete current['nightscout_url'];
    delete current['statusText'];
    delete current['statusUrl'];
    var cleansed = [
      ['version', getQueryParam('version')],
      ['pf', getQueryParam('pf')],
      ['fw', getQueryParam('fw')],
      ['at', getQueryParam('at')],
      ['wt', getQueryParam('wt')],
      ['current', JSON.stringify(current)],
    ].filter(function(pair) {
      return pair[1] !== false;
    }).map(function(pair) {
      return pair[0] + '=' + pair[1];
    }).join('&');

    ga('create', 'UA-72399627-1', 'auto');
    ga('send', 'pageview', location.pathname + '?' + cleansed);
  }

  $(function() {

    var phoneConfig = JSON.parse(getQueryParam('current', '{}'));
    var current = upgradeConfig(phoneConfig);
    populateValues(current);

    $('#update-available #running-version').text(getQueryParam('version') || '0.0.0');
    $('#update-available #available-version').text(c.VERSION);
    $('#update-available').toggle(c.VERSION !== getQueryParam('version'));

    $('#statusContent').on('change', function(evt) {
      $('#status-text-container').toggle(evt.currentTarget.value === 'customtext');
      $('#status-url-container').toggle(evt.currentTarget.value === 'customurl');
      $('#status-raw-count-container').toggle(evt.currentTarget.value === 'rawdata' || evt.currentTarget.value === 'rig-raw');
    });
    $('#statusContent').trigger('change');

    $('#basalGraph').on('change', function(evt) {
      $('#basal-height-container').toggle($(evt.currentTarget).is(':checked'));
    });
    $('#basalGraph').trigger('change');

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
      maybeUpdateSelectedLayout();
    });

    $('.layout-order input').on('change', function() {
      updateLayoutUpDownEnabledState();
      reorderLayoutInputs();
      maybeUpdateSelectedLayout();
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
    ].join(', ')).on('change', maybeUpdateSelectedLayout);

    document.getElementById('config-form').addEventListener('submit', onSubmit);

    trackGA();

  });
})(Zepto, CONSTANTS);
