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

    it('should return the number of 9-px points visible with a 4-px margin', function() {
      var config = {
        pointShape: 'circle',
        pointWidth: 9,
        pointRectHeight: 9,
        pointMargin: 4,
        pointRightMargin: 4,
      };
      expect(points.computeVisiblePoints(144, config)).to.be(11);
      config.pointRightMargin = 5;
      expect(points.computeVisiblePoints(144, config)).to.be(11);
      config.pointRightMargin = 6;
      expect(points.computeVisiblePoints(144, config)).to.be(10);
    });

    it('should return the number of 5-px points visible with a 4-px margin', function() {
      var config = {
        pointShape: 'rectangle',
        pointWidth: 5,
        pointRectHeight: 5,
        pointMargin: 4,
        pointRightMargin: 0,
      };
      expect(points.computeVisiblePoints(144, config)).to.be(16);
      config.pointRightMargin = 4;
      expect(points.computeVisiblePoints(144, config)).to.be(16);
      config.pointRightMargin = 5;
      expect(points.computeVisiblePoints(144, config)).to.be(15);
      config.pointRightMargin = 13;
      expect(points.computeVisiblePoints(144, config)).to.be(15);
      config.pointRightMargin = 14;
      expect(points.computeVisiblePoints(144, config)).to.be(14);
    });

    it('should work with a 108-px screen width', function() {
      var config = {
        pointShape: 'rectangle',
        pointWidth: 4,
        pointRectHeight: 5,
        pointMargin: 1,
        pointRightMargin: 0,
      };
      expect(points.computeVisiblePoints(108, config)).to.be(21);
    });

    it('should handle negative point margins', function() {
      var config = {
        pointShape: 'rectangle',
        pointWidth: 3,
        pointRectHeight: 3,
        pointMargin: -1,
        pointRightMargin: 0,
      };
      expect(points.computeVisiblePoints(108, config)).to.be(54);
    });

  });

});
