/* jshint browser: true */
/* global module, console */

var Cache = function(key, maxEntries) {
  this.storageKey = 'cache_' + key;
  this.maxEntries = maxEntries;
  this.entries = [];
  this.revive();
};

Cache.prototype.revive = function() {
  var cached = localStorage.getItem(this.storageKey);
  if (cached) {
    try {
      this.entries = JSON.parse(cached);
    } catch (e) {
      console.log('Bad value for ' + this.storageKey + ': ' + cached);
    }
  }
};

Cache.prototype.persist = function() {
  localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
};

Cache.prototype.update = function(newEntries) {
  this.entries = newEntries.concat(this.entries).slice(0, this.maxEntries);
  this.persist();

  // Deep copy so the cache can't be mutated
  return JSON.parse(JSON.stringify(this.entries));
};

Cache.prototype.clear = function() {
  this.entries = [];
  this.persist();
};

if (typeof(module) !== 'undefined') {
  module.exports = Cache;
}
