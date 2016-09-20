/* jshint node: true */
/* globals describe, it, beforeEach */
"use strict";

var expect = require('expect.js'),
  timekeeper = require('timekeeper');

var cache = require('../../src/js/cache.js');

describe('Cache', function() {
  beforeEach(function() {
    global.localStorage = require('./make_mock_local_storage.js')();
  });

  describe('new', function() {
    it('should use a distinct localStorage key', function() {
      var first = new cache.WithMaxSize('first', 10);
      first.update([9, 8, 7]);
      var second = new cache.WithMaxSize('second', 10);
      second.update([5, 4, 3]);
      expect(first.entries).to.eql([9, 8, 7]);
      expect(second.entries).to.eql([5, 4, 3]);
    });
  });

  describe('update', function() {
    it('should prepend', function() {
      var c = new cache.WithMaxSize('foo', 10);
      c.update([1, 2]);
      c.update([3, 4]);
      expect(c.entries).to.eql([3, 4, 1, 2]);
    });

    it('should truncate after maxSize', function() {
      var c = new cache.WithMaxSize('foo', 6);
      c.update([1, 2, 3, 4]);
      c.update([5, 6, 7, 8]);
      expect(c.entries).to.eql([5, 6, 7, 8, 1, 2]);
    });

    it('should truncate after maxSecondsOld', function() {
      var now = new Date();
      timekeeper.freeze(now);
      var c = new cache.WithMaxAge('bar', 10 * 60);
      c.update([
        {'sgv': 1, 'date': now - 3 * 60 * 1000},
        {'sgv': 2, 'date': now - 5 * 60 * 1000},
        {'sgv': 3, 'date': now - 10 * 60 * 1000},
        {'sgv': 4, 'date': now - 10 * 60 * 1000 - 1},
      ]);
      expect(c.entries).to.eql([
        {'sgv': 1, 'date': now - 3 * 60 * 1000},
        {'sgv': 2, 'date': now - 5 * 60 * 1000},
        {'sgv': 3, 'date': now - 10 * 60 * 1000},
      ]);
    });
  });

  describe('revive', function() {
    it('should revive from localStorage', function() {
       var first = new cache.WithMaxSize('sameKey', 5);
       first.update([99, 88, 77]);
       var second = new cache.WithMaxSize('sameKey', 5);
       expect(second.entries).to.eql([99, 88, 77]);
    });
  });

  describe('clear', function() {
    it('should empty the cache, which remains empty after reviving', function() {
       var first = new cache.WithMaxSize('sameKey', 5);
       first.update([123, 456]);
       expect(first.entries).to.eql([123, 456]);
       first.clear();
       expect(first.entries).to.eql([]);
       var second = new cache.WithMaxSize('sameKey', 5);
       expect(second.entries).to.eql([]);
    });
  });

  describe('setMaxSize', function() {
    it('should change the cache capacity', function() {
      var c = new cache.WithMaxSize('foo', 4);
      c.update([1, 2, 3, 4, 5, 6]);
      expect(c.entries).to.eql([1, 2, 3, 4]);
      c.update([9, 8]);
      expect(c.entries).to.eql([9, 8, 1, 2]);
      c.setMaxSize(6);
      c.update([11, 12, 13]);
      expect(c.entries).to.eql([11, 12, 13, 9, 8, 1]);
      c.setMaxSize(3);
      c.update([-5]);
      expect(c.entries).to.eql([-5, 11, 12]);
    });
  });

  describe('setMaxSecondsOld', function() {
    it('should change the cache threshold', function() {
      var now = new Date();
      timekeeper.freeze(now);
      var c = new cache.WithMaxAge('bar', 10 * 60);
      c.update([
        {'sgv': 1, 'date': now - 3 * 60 * 1000},
        {'sgv': 2, 'date': now - 5 * 60 * 1000},
        {'sgv': 3, 'date': now - 10 * 60 * 1000},
      ]);
      expect(c.entries).to.eql([
        {'sgv': 1, 'date': now - 3 * 60 * 1000},
        {'sgv': 2, 'date': now - 5 * 60 * 1000},
        {'sgv': 3, 'date': now - 10 * 60 * 1000},
      ]);
      c.setMaxSecondsOld(6 * 60);
      c.update([
        {'sgv': 0, 'date': now - 2 * 60 * 1000},
      ]);
      expect(c.entries).to.eql([
        {'sgv': 0, 'date': now - 2 * 60 * 1000},
        {'sgv': 1, 'date': now - 3 * 60 * 1000},
        {'sgv': 2, 'date': now - 5 * 60 * 1000},
      ]);
      c.setMaxSecondsOld(2.5 * 60);
      c.update([
        {'sgv': -1, 'date': now - 1 * 60 * 1000},
      ]);
      expect(c.entries).to.eql([
        {'sgv': -1, 'date': now - 1 * 60 * 1000},
        {'sgv': 0, 'date': now - 2 * 60 * 1000},
      ]);
    });
  });

});
