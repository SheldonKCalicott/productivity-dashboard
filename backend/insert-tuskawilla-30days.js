// Run this script with: node insert-tuskawilla-30days.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'productivity.db');
const db = new sqlite3.Database(dbPath);

const storeNumber = 'Tuskawilla';
const dayparts = [
  { key: 'breakfast', sales: 6000, productivity: 105, target: 105, pic: 'Alice' },
  { key: 'lunch', sales: 10000, productivity: 110, target: 108, pic: 'Bob' },
  { key: 'afternoon', sales: 7000, productivity: 102, target: 105, pic: 'Carol' },
  { key: 'dinner', sales: 8000, productivity: 108, target: 110, pic: 'Dave' }
];

function pad(n) { return n < 10 ? '0' + n : n; }

function getDateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

db.serialize(() => {
  for (let i = 0; i < 30; i++) {
    const date = getDateNDaysAgo(i);
    dayparts.forEach(dp => {
      db.run(
        `INSERT OR REPLACE INTO productivity_records (store_number, record_date, daypart, sales_amount, actual_productivity, target_productivity, pic_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [storeNumber, date, dp.key, dp.sales, dp.productivity, dp.target, dp.pic],
        function (err) {
          if (err) {
            console.error(`Error inserting ${dp.key} for ${date}:`, err.message);
          }
        }
      );
    });
  }
});

db.close(() => {
  console.log('Inserted 30 days of test data for Tuskawilla.');
});
