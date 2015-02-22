(function () {
  'use strict';

  var scraperjs = require('scraperjs');

  /**
   * given a text of a td, cleans it up using some regX magic and returns
   * pretty version
   *
   * @param {String} text
   * @returns {String}
   */
  function cleanUpText (text) {
    text = text.trim().toUpperCase();
    text = text.replace(/[\f\n\r\t\v​\u00a0\u1680​\u180e\u2000​\u2001\u2002​\u2003\u2004​\u2005\u2006​\u2007\u2008​\u2009\u200a​\u2028\u2029​​\u202f\u205f​\u3000]/g, ' ');
    while (text.search(/(  )/) > -1) {
      text = text.replace(/(  )/g, ' ');
    }

    return text;
  }

  /**
   * given a cleaned up text, returns a yet a prettier version (date hence `D`)
   * PS: the function is in no way to be vulgar
   *
   * @param {String} text
   * @returns {String} - `dddd MMM D, YYYY`
   */
  function cleanD (text) {
    return text.replace(/( ?, ?)/g, ', ').substring(0, (text.search(/\d{4}/) + 4));
  }

  // the following two "closure" are used to somewhat "cache" our
  // super-efficient ;) scrapper
  var td = null,
      showtime = {};

  module.exports = function (callback) {
    if (td === null) {
      scraperjs.StaticScraper
        .create('http://ednamall.info/show_time.html')
        .scrape(function ($) {
          /**
           * we're going to make a BOLD / smart assumption that query selector
           * `table#timetable > tbody > tr > td` is going to return 280 td nodes
           *
           * i highly doubt that `they` are EVER (like in infinity years) going
           * to change the count seeing how the "code" is written, but if that
           * day ever comes am going to have my work cut out for moi :)
           *
           * PS: obviously seeing how the "styling" is applied on the "page"
           * relying on class name / id is like relying on <insert racist joke here>
           */
          td = $('table#timetable > tbody > tr > td');

          showtime = {
            cinemaOne: {},
            cinemaTwo: {},
            cinemaThree: {}
          };

          // <td> date container list
          var dayRunner = [cleanD(cleanUpText($(td[0]).text())),    // Friday
                           cleanD(cleanUpText($(td[40]).text())),   // Saturday
                           cleanD(cleanUpText($(td[80]).text())),   // Sunday
                           cleanD(cleanUpText($(td[120]).text())),  // Monday
                           cleanD(cleanUpText($(td[160]).text())),  // Tuesday
                           cleanD(cleanUpText($(td[200]).text())),  // Wednesday
                           cleanD(cleanUpText($(td[240]).text()))], // Thursday
              cinemaFactor = 0,
              cinemaOneFactor = 10,
              cinemaTwoFactor = 12,
              cinemaThreeFactor = 14;

          dayRunner.map(function (day, dindex, dlist) {
            cinemaFactor = dindex * 40;
            showtime.cinemaOne[day] = [];
            showtime.cinemaTwo[day] = [];
            showtime.cinemaThree[day] = [];

            // 5 movies / day in each cinema
            for (var i = 0; i < 5; i++) {
              var iCONSTANT = cinemaFactor + (i * 6);

              showtime.cinemaOne[day].push({
                'showtime': cleanUpText($(td[iCONSTANT + cinemaOneFactor]).text()),
                'movie':    cleanUpText($(td[iCONSTANT + cinemaOneFactor + 1]).text())
              });

              showtime.cinemaTwo[day].push({
                'showtime': cleanUpText($(td[iCONSTANT + cinemaTwoFactor]).text()),
                'movie':    cleanUpText($(td[iCONSTANT + cinemaTwoFactor + 1]).text())
              });

              showtime.cinemaThree[day].push({
                'showtime': cleanUpText($(td[iCONSTANT + cinemaThreeFactor]).text()),
                'movie':    cleanUpText($(td[iCONSTANT + cinemaThreeFactor + 1]).text())
              });
            }
          });

          return showtime;
        }, function (showtime) {
          callback(showtime);
        });
    } else {
      callback(showtime);
    }
  };

})();