const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  kits: 'kits.json',
  verified: 'verified.json',
  tokens: 'tokens.json',
  queue: 'queue.json',
  stats: 'stats.json',
  ads: 'ads.json',
};

function read(file, def) {
  const p = path.join(DATA_DIR, file);
  try {
    if (!fs.existsSync(p)) return def;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return def; }
}
function write(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

let kits = read(FILES.kits, {});
let verified = read(FILES.verified, {});
let tokens = read(FILES.tokens, {});
let queue = read(FILES.queue, []);
let stats = read(FILES.stats, {
  date: new Date().toISOString().slice(0, 10),
  ordersToday: 0, successful: 0, failed: 0, kitsDelivered: 0, tokensCharged: 0,
});
let ads = read(FILES.ads, { lastAd: 0 });

function saveKits() { write(FILES.kits, kits); }
function saveVerified() { write(FILES.verified, verified); }
function saveTokens() { write(FILES.tokens, tokens); }
function saveQueue() { write(FILES.queue, queue); }
function saveStats() { write(FILES.stats, stats); }
function saveAds() { write(FILES.ads, ads); }

module.exports = {
  getKits: () => kits,
  setKits(newKits) { kits = newKits; saveKits(); },
  getKit(name) { return kits[name]; },
  addKitStock(kit, amount) { if (kits[kit]) { kits[kit].stock += amount; saveKits(); } },
  removeKitStock(kit, amount) { if (kits[kit]) { kits[kit].stock = Math.max(0, kits[kit].stock - amount); saveKits(); } },
  setKitStock(kit, amount) { if (kits[kit]) { kits[kit].stock = amount; saveKits(); } },
  setKitField(kit, field, value) { if (kits[kit]) { kits[kit][field] = value; saveKits(); } },
  reloadKits() { kits = read(FILES.kits, {}); },

  getVerified: () => verified,
  isVerified(player) { return !!verified[player]; },
  isBooster(player) { return !!verified[player]?.booster; },
  isOwner(player) { return !!verified[player]?.owner; },
  setVerified(player, data) { verified[player] = data; saveVerified(); },
  reloadVerified() { verified = read(FILES.verified, {}); },

  getTokens(player) { return tokens[player] ?? 0; },
  setTokens(player, amount) { tokens[player] = amount; saveTokens(); },
  addTokens(player, amount) { tokens[player] = (tokens[player] ?? 0) + amount; saveTokens(); },

  getQueue: () => queue,
  setQueue(newQ) { queue = newQ; saveQueue(); },
  addToQueue(entry) { queue.push(entry); saveQueue(); },
  removeFromQueue(id) { queue = queue.filter(q => q.id !== id); saveQueue(); },
  saveQueueState() { saveQueue(); },
  clearQueue() { queue = []; saveQueue(); },

  getStats: () => stats,
  incStat(key, n = 1) {
    const today = new Date().toISOString().slice(0, 10);
    if (stats.date !== today) {
      stats = { date: today, ordersToday: 0, successful: 0, failed: 0, kitsDelivered: 0, tokensCharged: 0 };
    }
    stats[key] = (stats[key] ?? 0) + n;
    saveStats();
  },

  getLastAd: () => ads.lastAd,
  setLastAd(ts) { ads.lastAd = ts; saveAds(); },

  reloadAll() {
    kits = read(FILES.kits, {});
    verified = read(FILES.verified, {});
    tokens = read(FILES.tokens, {});
    queue = read(FILES.queue, []);
  },
};
