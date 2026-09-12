// Creates default data files if they do not exist.
// Usage: node scripts/seed.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function writeIfMissing(file, data) {
  const p = path.join(DATA_DIR, file);
  if (fs.existsSync(p)) { console.log('exists, skipped:', file); return; }
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  console.log('seeded:', file);
}

writeIfMissing('kits.json', {
  diamond: { stock: 42, price: 1, contents: ['Diamond Armor set', 'Diamond Sword', 'Diamond Pickaxe', 'Shulker Box'] },
  netherite: { stock: 5, price: 1, contents: ['Netherite Armor set', 'Netherite Sword'] },
  elytra: { stock: 0, price: 1, contents: ['Elytra', 'Rockets'] },
  building: { stock: 100, price: 1, contents: ['32 Shulker Boxes of blocks'] },
});
writeIfMissing('verified.json', {});
writeIfMissing('tokens.json', {});
writeIfMissing('queue.json', []);
writeIfMissing('stats.json', {
  date: new Date().toISOString().slice(0, 10),
  ordersToday: 0, successful: 0, failed: 0, kitsDelivered: 0, tokensCharged: 0,
});
writeIfMissing('ads.json', { lastAd: 0 });

console.log('Seed complete. Edit data/kits.json and .env before starting.');
