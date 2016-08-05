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
  Array.prototype.unshift.apply(this.entries, newEntries);
  while (this.entries.length > this.maxEntries) {
    this.entries.pop();
  }
  this.persist();
  return this.entries;
};

Cache.prototype.clear = function() {
  this.entries = [];
  this.persist();
};

module.exports = Cache;
