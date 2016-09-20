/* jshint browser: true */
/* global module, console */

var Cache = function() {};

Cache.prototype.init = function(key) {
  this.storageKey = 'cache_' + key;
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
  this.entries = newEntries.concat(this.entries);
  this.purge();
  this.persist();
  return this.entries;
};

Cache.prototype.clear = function() {
  this.entries = [];
  this.persist();
};

////////////////

var CacheWithMaxAge = function(key, maxSecondsOld) {
  this.init(key);
  this.maxSecondsOld = maxSecondsOld;
};

CacheWithMaxAge.prototype = Object.create(Cache.prototype);

CacheWithMaxAge.prototype.purge = function() {
  this.entries = this.entries.filter(function(e) {
    // For now, assume "date" holds the timestamp, formatted as epoch milliseconds
    // (This generally holds only for the "entries" collection)
    return e['date'] >= Date.now() - this.maxSecondsOld * 1000;
  }.bind(this));
};

CacheWithMaxAge.prototype.setMaxSecondsOld = function(newMax) {
  this.maxSecondsOld = newMax;
};

////////////////

var CacheWithMaxSize = function(key, maxSize) {
  this.init(key);
  this.maxSize = maxSize;
};

CacheWithMaxSize.prototype = Object.create(Cache.prototype);

CacheWithMaxSize.prototype.purge = function() {
  this.entries = this.entries.slice(0, this.maxSize);
};

CacheWithMaxSize.prototype.setMaxSize = function(newMax) {
  this.maxSize = newMax;
};

////////////////

module.exports = {
  WithMaxAge: CacheWithMaxAge,
  WithMaxSize: CacheWithMaxSize,
};
