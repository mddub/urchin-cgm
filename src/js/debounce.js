/* global module */

/*
 * When a function which makes a network request is called multiple times in a
 * short period (e.g. its data is needed in two different contexts during a
 * single watch/phone request cycle), return the same Promise.
 *
 * NOTE: Data returned by the Promise is not immutable, so be careful about
 * transforming it.
 */
function debounce(fn) {
  var lastCallTime = -Infinity;
  var lastResult;

  return function() {
    if (Date.now() - lastCallTime < debounce.MEMOIZE_PERIOD_MS) {
      return lastResult;
    } else {
      lastCallTime = Date.now();
      lastResult = fn.apply(this, arguments);
      return lastResult;
    }
  };
}

debounce.MEMOIZE_PERIOD_MS = 1000;

if (typeof(module) !== 'undefined') {
  module.exports = debounce;
}
