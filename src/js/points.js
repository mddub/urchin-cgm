/* global module, window */

function points(c) {
  var p = {};

  p.computeGraphWidth = function(layout) {
    var graph = layout.elements.filter(function(e) { return c.ELEMENTS[e.el] === 'GRAPH_ELEMENT'; })[0];
    if (graph !== undefined) {
      return Math.round(c.SCREEN_WIDTH * graph.width / 100);
    } else {
      return 0;
    }
  };

  p.computeVisiblePoints = function(width, config) {
    var available = width - config.pointRightMargin;
    var points = Math.ceil(available / (config.pointWidth + config.pointMargin));
    return points;
  };

  return p;
}

// TODO: include this in the config page in a better way
if (typeof(module) !== 'undefined') {
  module.exports = points;
}
if (typeof(window) !== 'undefined') {
  window.points = points;
}
