/* jshint node: true */
/* globals describe, it */
"use strict";

var expect = require('expect.js'),
  timekeeper = require('timekeeper');

var debounce = require('../../src/js/debounce.js');

describe('debounce', function() {
  function fn(i) {
    return {
      calledWith: i,
      calledAt: new Date()
    };
  }

  it('should return the same value if called within MEMOIZE_PERIOD_MS ms of the last call', function() {
    var debounced = debounce(fn);
    var now = new Date();
    timekeeper.freeze(now);
    var first = debounced(1);
    timekeeper.freeze(new Date(now.getTime() + debounce.MEMOIZE_PERIOD_MS - 1));
    var second = debounced(2);
    timekeeper.freeze(new Date(now.getTime() + debounce.MEMOIZE_PERIOD_MS + 1));
    var third = debounced(3);
    timekeeper.freeze(new Date(now.getTime() + debounce.MEMOIZE_PERIOD_MS + 3));
    var fourth = debounced(4);
    expect(first).to.be(second);
    expect(second).not.to.be(third);
    expect(third).to.be(fourth);
  });
});
