/* global module, console */

var Debug = function(c) {
  return {
    log: function(str) {
      if (c.DEBUG) {
        console.log(str);
      }
    }
  };
};

module.exports = Debug;
