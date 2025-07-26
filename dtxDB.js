
const db = require('./db.json');

function getSongsInRange(low, high) {
    return db.filter((x) => x.difficulties.some((y) => y >= low && y <= high));
}

module.exports = {db, getSongsInRange};