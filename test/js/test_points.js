/* jshint node: true */
/* globals describe, it */
"use strict";

var expect = require('expect.js');

var c = require('../../src/js/constants.json');
var points = require('../../src/js/points')(c);

describe('points', function() {

  describe('computeGraphWidth', function() {

    it('should return the correct value for a 100%-width graph', function() {
      var layout = {elements: [{el: c.ELEMENTS.indexOf('GRAPH_ELEMENT'), width: 100}]};
      expect(points.computeGraphWidth(layout)).to.be(144);
    });

    it('should return the correct value for a 75%-width graph', function() {
      var layout = {elements: [{el: c.ELEMENTS.indexOf('GRAPH_ELEMENT'), width: 75}]};
      expect(points.computeGraphWidth(layout)).to.be(108);
    });

    it('should return 0 when there is no graph', function() {
      var layout = {elements: []};
      expect(points.computeGraphWidth(layout)).to.be(0);
    });

  });

  describe('computeVisiblePoints', function() {

    it('should return the number of 9-px points visible', function() {
      var config = {
        pointShape: 'circle',
        pointWidth: 9,
        pointHeight: 9, // unused for circle
        pointMargin: 4,
        pointRightMargin: 13,
      };
      expect(points.computeVisiblePoints(144, config)).to.be(11);
      config.pointRightMargin = 14;
      expect(points.computeVisiblePoints(144, config)).to.be(10);
      config.pointRightMargin = 15;
      expect(points.computeVisiblePoints(144, config)).to.be(10);
    });

    it('should return the number of 5-px points visible', function() {
      var config = {
        pointShape: 'rectangle',
        pointWidth: 5,
        pointHeight: 5,
        pointMargin: 4,
        pointRightMargin: 0,
      };
      expect(points.computeVisiblePoints(144, config)).to.be(16);
      config.pointRightMargin = 1;
      expect(points.computeVisiblePoints(144, config)).to.be(16);
      config.pointRightMargin = 8;
      expect(points.computeVisiblePoints(144, config)).to.be(16);
      config.pointRightMargin = 9;
      expect(points.computeVisiblePoints(144, config)).to.be(15);
    });

    it('should return the number of 4-px points visible', function() {
      var config = {
        pointShape: 'rectangle',
        pointWidth: 4,
        pointHeight: 5,
        pointMargin: 1,
        pointRightMargin: 0,
      };
      expect(points.computeVisiblePoints(108, config)).to.be(22);
    });

    it('should handle negative point margins', function() {
      var config = {
        pointShape: 'rectangle',
        pointWidth: 3,
        pointHeight: 3,
        pointMargin: -1,
        pointRightMargin: 0,
      };
      expect(points.computeVisiblePoints(108, config)).to.be(54);
    });

  });

});
