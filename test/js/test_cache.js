/* jshint node: true */
/* globals describe, it, beforeEach */
"use strict";

var expect = require('expect.js');

var Cache = require('../../src/js/cache.js');

describe('Cache', function() {
  beforeEach(function() {
    global.localStorage = require('./make_mock_local_storage.js')();
  });

  describe('new', function() {
    it('should use a distinct localStorage key', function() {
      var first = new Cache('first', 10);
      first.update([9, 8, 7]);
      var second = new Cache('second', 10);
      second.update([5, 4, 3]);
      expect(first.entries).to.eql([9, 8, 7]);
      expect(second.entries).to.eql([5, 4, 3]);
    });
  });

  describe('update', function() {
    it('should prepend', function() {
      var c = new Cache('foo', 10);
      c.update([1, 2]);
      c.update([3, 4]);
      expect(c.entries).to.eql([3, 4, 1, 2]);
    });

    it('should truncate after maxEntries', function() {
      var c = new Cache('foo', 6);
      c.update([1, 2, 3, 4]);
      c.update([5, 6, 7, 8]);
      expect(c.entries).to.eql([5, 6, 7, 8, 1, 2]);
    });
  });

  describe('revive', function() {
    it('should revive from localStorage', function() {
       var first = new Cache('sameKey', 5);
       first.update([99, 88, 77]);
       var second = new Cache('sameKey', 5);
       expect(second.entries).to.eql([99, 88, 77]);
    });
  });

  describe('clear', function() {
    it('should empty the cache, which remains empty after reviving', function() {
       var first = new Cache('sameKey', 5);
       first.update([123, 456]);
       expect(first.entries).to.eql([123, 456]);
       first.clear();
       expect(first.entries).to.eql([]);
       var second = new Cache('sameKey', 5);
       expect(second.entries).to.eql([]);
    });
  });

});
