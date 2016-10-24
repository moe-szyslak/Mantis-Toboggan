/**
 * checks for cache in our showtime detail db
 *
 * @param  {Object} moedoo
 * @param  {String} title
 * @param {Object} detail
 * @return {Promise}
 */
module.exports = (moedoo, detail = '', video) => new Promise((resolve, reject) => {
  if (video === undefined) {
    moedoo
      .query('SELECT video FROM detail WHERE detail = $1;', [detail])
      .then((result) => {
        resolve(result.length === 1 ? result[0].video : 'ø');
      })
      .catch(() => {
        resolve('ø');
      });
  } else {
    moedoo
      .query('INSERT INTO detail (detail, video) VALUES ($1, $2) returning video;', [detail, video])
      .then((result) => {
        resolve(result[0].video);
      })
      .catch((err) => {
        reject(err);
      });
  }
});
