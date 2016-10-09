/* global module, window */

var translations = {
  'English': {
    'month': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'monthShort': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'day': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    'dayShort': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  // TODO
};

function dateFormatter(format) {
  var now = new Date();
  var year = 1900 + now.getYear();
  var month = now.getMonth();
  var date = now.getDate();
  var day = now.getDay();

  var yyyy = year.toString();
  var yy = year.toString().slice(-2);

  var language = 'English';

  var mmmm = translations[language]['month'][month];
  var mmm = translations[language]['monthShort'][month];
  var mm = ('0' + (month + 1)).slice(-2);
  var m = (month + 1).toString();

  var dddd = translations[language]['day'][day];
  var ddd = translations[language]['dayShort'][day];

  var dd = ('0' + date).slice(-2);
  var d = date.toString();

  return format
    .replace('yyyy', '%YYYY%')
    .replace('yy', '%YY%')
    .replace('mmmm', '%MMMM%')
    .replace('mmm', '%MMM%')
    .replace('mm', '%MM%')
    .replace('m', '%M%')
    .replace('dddd', '%DDDD%')
    .replace('ddd', '%DDD%')
    .replace('dd', '%DD%')
    .replace('d', '%D%')
    .replace('%YYYY%', yyyy)
    .replace('%YY%', yy)
    .replace('%MMMM%', mmmm)
    .replace('%MMM%', mmm)
    .replace('%MM%', mm)
    .replace('%M%', m)
    .replace('%DDDD%', dddd)
    .replace('%DDD%', ddd)
    .replace('%DD%', dd)
    .replace('%D%', d);
}

// TODO: include this in the config page in a better way
if (typeof(module) !== 'undefined') {
  module.exports = dateFormatter;
}
if (typeof(window) !== 'undefined') {
  window.dateFormatter = dateFormatter;
}
