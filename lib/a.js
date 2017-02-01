/* eslint no-console: 0 */

const cheerio = require('cheerio');
const request = require('superagent');
const moment = require('moment');
const geezer = require('geezer');
const { ge } = require('ethiopic-calendar');

const config = require('./../config');
const omdbCache = require('./omdbCache');
const { gregorianWeekdayToEthiopicWeekday, ethiopicMonthToFullEthiopicMonth } = require('./ec');

/**
 * a (get it) scraper targeting http://ednamall.co/
 */
module.exports = moedoo => () => new Promise((resolve, reject) => {
  request
    .get(encodeURI(decodeURI(config.URL)))
    .then((res) => {
      // loading the body in cheerio...
      const $ = cheerio.load(res.text);
      const EDNA_MAIN_SELECTOR = '.showtimes-theater-header a.light.showtimes-theater-title[href*="Edna Cinema"]';
      const DD_MM_YY_SELECTOR = 'ul.date-picker li a.date-area.date-selected';

      // Checking for Edna Schedule...
      if ($(EDNA_MAIN_SELECTOR).length === 0) {
        reject('no Edna shows yet');
        return;
      }

      // Reading site date...
      const [month, date, year] = $(DD_MM_YY_SELECTOR).attr('href').match(/([0-9]{2})/g);
      // Gregorian Calendar Moment
      const gCMoment = moment(`${date}-${month}-${year}`, 'DD-MM-YY');
      // Ethiopic Object { year, month, date }
      const ethiopicCalendar = ge(gCMoment.year(), gCMoment.month() + 1, gCMoment.date());

      // Filtering Edna movies...
      const ednaMallCells = $('.showtimes-movie-container').toArray().filter(container => $('.showtimes-movie-overview img[alt*="Edna Cinema"]', container).length > 0);
      const cinema = { c1: [], c2: [], c3: [] };
      const omdbMapper = []; // { title, indices }

      ednaMallCells.forEach((ednaMallCell) => {
        // Full Poster URL
        const posterURL = `${config.URL_BASE}${$('.showtimes-movie-poster > a', ednaMallCell).attr('href').replace(/^\.\.\//, '')}`;

        // Movie Title ((2|3)D) removed and trimmed
        const title = $('.showtimes-movie-detail [class*="heading"]', ednaMallCell).text().replace(/\((2|3)D\)/g, '').trim();

        // Cinema Detection
        const cinemaLabel = $('.cinema-number', ednaMallCell).text();
        // eslint-disable-next-line
        const cinemaNumber = /cinema 1/i.test(cinemaLabel) ? 1 : /cinema 2/i.test(cinemaLabel) ? 2 : 3;

        // Showtimes (AM|PM|ET) removed and trimmed
        const showtimes = $('.showtimes-times .btn', ednaMallCell).toArray().map((showtime) => {
          const showtimeMoment = moment($(showtime).text().replace(/(ET)|(AM)|(PM)/ig, '').trim(), 'h:mm');

          // since showtime starts at noon...
          if (showtimeMoment.hour() >= 6 && showtimeMoment.hour() <= 12) {
            return {
              et: `${showtimeMoment.format('h:mm')} ቀን`,
              gc: showtimeMoment.add(6, 'hours').format('h:mm A'),
            };
          }

          return {
            et: `${showtimeMoment.format('h:mm')} ምሽት`,
            gc: showtimeMoment.add(18, 'hours').format('h:mm A'),
          };
        });

        const indices = [];
        showtimes.forEach((showtime) => {
          indices.push({
            cinema: `c${cinemaNumber}`,
            index: cinema[`c${cinemaNumber}`].length,
          });

          cinema[`c${cinemaNumber}`].push({
            title,
            posterURL,
            showtime,
            detail: null,
          });
        });

        omdbMapper.push({
          title,
          indices,
        });
      });

      // Build omdb promise for each movie...
      const omdbMapperPromises = omdbMapper.map(omdb => omdbCache(moedoo, omdb.title));
      Promise
        .all(omdbMapperPromises)
        .then((omdbData) => {
          omdbData.forEach((omdbResponse, index) => {
            if (omdbResponse !== null) {
              // updating movie detail...
              omdbMapper[index].indices.forEach((omdbMapIndex) => {
                cinema[omdbMapIndex.cinema][omdbMapIndex.index].title = omdbResponse.Title;
                cinema[omdbMapIndex.cinema][omdbMapIndex.index].posterURL = omdbResponse.Poster;
                cinema[omdbMapIndex.cinema][omdbMapIndex.index].detail = omdbResponse;
              });
            }
          });

          resolve({
            show: cinema,
            meta: {
              gc: `${gCMoment.format('dddd, MMMM D')}`,
              ec: `${gregorianWeekdayToEthiopicWeekday(gCMoment.format('dddd'))}, ${ethiopicMonthToFullEthiopicMonth(ethiopicCalendar.month)} ${geezer(ethiopicCalendar.day)}`,
            },
          });
        }, () => {
          // resolving with all null detail
          resolve({
            show: cinema,
            meta: {
              gc: `${gCMoment.format('dddd, MMMM D')}`,
              ec: `${gregorianWeekdayToEthiopicWeekday(gCMoment.format('dddd'))}, ${ethiopicMonthToFullEthiopicMonth(ethiopicCalendar.month)} ${geezer(ethiopicCalendar.day)}`,
            },
          });
        });
    }, (err) => {
      reject(err);
    });
});
