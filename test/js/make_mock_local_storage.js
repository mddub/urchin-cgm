/* jshint node: true */
"use strict";

module.exports = function makeMockLocalStorage() {
  var store = {};
  return {
    setItem: function(key, val) { store[key] = val; },
    getItem: function(key) { return store[key]; }
  };
};
