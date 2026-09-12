const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');

// ---------- IO ----------
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, f))); } catch { return d; } };
const save = (f, o) => fs.writeFileSync(path.join(__dirname, f), JSON.stringify(o, null, 2));
const sleep = ms => new Promise(r => setTimeout(r, ms));

let CFG = load('config.json', {});
let KITS = load('kits.json', {});
let VERIFIED = load('verified.json', {});
let ST = load('state.json', null) || {
  tokens: {}, queue: [], boosters: [],
  stats: { ordersToday: 0, successful: 0, failed: 0, kitsDelivered: 0, tokensCharged: 0 },
  logs: [], errors: [], lastAd: 0, nextId: 1
};
if (!ST.logs) ST.logs = []; if (!ST.errors) ST.errors = []; if (!ST.boosters) ST.boosters = [];
const saveState = () => save('state.json', ST);
const saveKits = () => save('kits.json', KITS);
const saveVer = () => save('verified.json', VERIFIED);

// ---------- helpers ----------
const pre = CFG.prefix || '.x';
const isAdmin = u => CFG.admins.includes(u);
const isBooster = u => CFG.boosters.includes(u) || ST.boosters.includes(u) || (VERIFIED[u] && VERIFIED[u].booster);
const isVerified = u => !!VERIFIED[u];
const tokens = u => { if (ST.tokens[u] == null) ST.tokens[u] = CFG.startingTokens; return ST.tokens[u]; };
const charge = (u, n) => { tokens(u); ST.tokens[u] = Math.max(0, ST.tokens[u] - n); saveState(); };
const grant = (u, n) => { tokens(u); ST.tokens[u] += n; saveState(); };
const maxKits = u => isAdmin(u) ? CFG.kitsMax.owner : isBooster(u) ? CFG.kitsMax.booster : CFG.kitsMax.normal;
const pushLog = m => { ST.logs.unshift(`[${new Date().toISOString()}] ${m}`); ST.logs=ST.logs.slice(0,20); saveState(); };
const pushErr = m => { ST.errors.unshift(`[${new Date().toISOString()}] ${m}`); ST.errors=ST.errors.slice(0,20); saveState(); };

let bot = null, current = null, lastTpa = 0;
const runtime = { paused: false, maintenance: false, reason: '' };

// ---------- queue ----------
function addOrder(player, kits, manual = false) {
  const order = { id: ST.nextId++, player, kits, manual, time: Date.now(), booster: isBooster(player) };
  const i = ST.queue.findIndex(o => !o.booster);
  if (order.booster && i !== -1) ST.queue.splice(i, 0, order); else ST.queue.push(order);
  saveState(); pushLog(`Queued #${order.id} ${player} [${kits.join(',')}] booster=${order.booster}`);
  return order;
}
function refundStock(o) { o.kits.forEach(k => { if (KITS[k]) KITS[k].stock++; }); saveKits(); }
function removeFromQueue(player) {
  const i = ST.queue.findIndex(o => o.player === player);
  if (i === -1) return null;
  const [o] = ST.queue.splice(i, 1); refundStock(o); saveState(); pushLog(`Cancelled #${o.id}`); return o;
}

// ---------- delivery ----------
function findKitStack(kit) {
  const items = bot.inventory.items();
  return items.find(it => ((it.displayName || it.name || '').toLowerCase().includes(kit.toLowerCase())))
    || items.find(it => (it.name || '').includes('shulker'));
}
async function dropKits(kits) {
  for (const k of kits) {
    const s = findKitStack(k);
    if (!s) { pushErr(`No stack for kit ${k}`); continue; }
    try { await bot.tossStack(s); } catch (e) { pushErr(`toss ${k}: ${e.message}`); }
    await sleep(300);
  }
}
function waitForTpa(player, timeout = 30000) {
  return new Promise(res => {
    let done = false;
    const fin = ok => { if (done) return; done = true; bot.off('message', onM); clearInterval(iv); clearTimeout(to); res(ok); };
    const onM = m => { const t = m.toString(); if (/denied|declined|cancel|expire/i.test(t)) fin(false); };
    const iv = setInterval(() => {
      const e = bot.players[player] && bot.players[player].entity;
      if (e && bot.entity && bot.entity.position.distanceTo(e.position) < 6) fin(true);
    }, 400);
    bot.on('message', onM);
    const to = setTimeout(() => fin(false), timeout);
  });
}
async function waitPickup(timeout) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    if (current && current.collectedBy) return current.collectedBy;
    await sleep(150);
  }
  return null;
}
async function deliver(o) {
  current = { ...o, collectedBy: null };
  pushLog(`Delivering #${o.id} to ${o.player}`);
  bot.whisper(o.player, "Your order is on the way. Please accept my TPA.");
  await sleep(1000);
  lastTpa = Date.now();
  bot.chat(`/tpa ${o.player}`);
  const ok = await waitForTpa(o.player);
  if (!ok) {
    bot.whisper(o.player, "TPA failed/denied/timed out. Order cancelled, no token charged.");
    ST.stats.failed++; pushErr(`TPA fail ${o.player}`); current = null; saveState(); return;
  }
  bot.whisper(o.player, "TPA successful.");
  await sleep(CFG.delivery.chunkWaitMs || 1500);
  const e = bot.players[o.player] && bot.players[o.player].entity;
  if (e) { try { await bot.lookAt(e.position.offset(0, 1.6, 0)); } catch {} }
  await sleep(300);
  await dropKits(o.kits);
  const pickedBy = await waitPickup(CFG.delivery.pickupTimeoutMs || 10000);
  if (!pickedBy) {
    bot.whisper(o.player, "Nobody picked up the items in time. Cancelled, no token charged.");
    ST.stats.failed++;
  } else if (pickedBy === o.player) {
    const cost = o.manual ? 0 : o.kits.length;
    if (cost) charge(o.player, cost);
    bot.whisper(o.player, `Item picked up. ${cost} token charged. Token balance: ${ST.tokens[o.player]}`);
    ST.stats.successful++; ST.stats.kitsDelivered += o.kits.length; ST.stats.tokensCharged += cost;
  } else {
    bot.whisper(pickedBy, `You picked up another player's order. Please return it to ${o.player}.`);
    bot.whisper(o.player, `Your order was picked up by ${pickedBy}. I've asked them to return it to you.`);
    ST.stats.failed++;
  }
  pushLog(`Finished #${o.id} pickedBy=${pickedBy || 'none'}`);
  // sneak + kill
  bot.setControlState('sneak', true); await sleep(CFG.delivery.sneakMs || 1000); bot.setControlState('sneak', false);
  await sleep(5000);
  bot.chat('/kill');
  setTimeout(() => { current = null; saveState(); processQueue(); }, 4000);
}
async function processQueue() {
  if (current || runtime.paused || runtime.maintenance || !bot || !bot.entity) return;
  if (Date.now() - lastTpa < (CFG.cooldowns.tpa * 1000)) return; // wait out tpa cooldown
  if (!ST.queue.length) return;
  const o = ST.queue.shift(); saveState();
  deliver(o).catch(e => { pushErr(`deliver: ${e.message}`); current = null; });
}

// ---------- commands ----------
function handleCommand(from, username, msg) {
  if (!msg.startsWith(pre)) return false;
  const a = msg.slice(pre.length).trim().split(/\s+/);
  const cmd = a.shift().toLowerCase();
  const R = m => bot.whisper(username, m);
  const needAdmin = () => { if (!isAdmin(username)) { R('No permission.'); return false; } return true; };

  switch (cmd) {
    // ---- player ----
    case 'kit': {
      if (!isVerified(username)) { R(`You're not verified. To get verified, please join ${CFG.discordLink}`); break; }
      if (!a.length) {
        const av = [], ou = [];
        for (const [k, v] of Object.entries(KITS)) (v.stock > 0 ? av : ou).push(k);
        R(`Kits available: ${av.join(', ') || 'none'}\nOut of stock: ${ou.join(', ') || 'none'}`);
        break;
      }
      const req = a.map(x => x.toLowerCase());
      const mx = maxKits(username);
      if (req.length > mx) { R(`Max ${mx} kits per order.`); break; }
      const bad = req.filter(k => !KITS[k]);
      if (bad.length) { R(`Unknown kit(s): ${bad.join(', ')}`); break; }
      const no = req.filter(k => KITS[k].stock <= 0);
      if (no.length) { R(`Out of stock: ${no.join(', ')}`); break; }
      if (tokens(username) < req.length) { R(`Need ${req.length} token(s), you have ${tokens(username)}.`); break; }
      req.forEach(k => KITS[k].stock--); saveKits();
      const o = addOrder(username, req);
      R(`You're in the queue. Please wait. Queue: ${ST.queue.findIndex(x => x.id === o.id) + 1}`);
      setTimeout(processQueue, 500);
      break;
    }
    case 'stock': {
      R(Object.entries(KITS).map(([k, v]) => `${k}: ${v.stock}`).join('\n')); break;
    }
    case 'queue': {
      if (isAdmin(username) && a.length && /^\d+$/.test(a[0])) {
        const n = parseInt(a[0]); const part = ST.queue.slice(0, n);
        R(part.length ? part.map((o, i) => `#${i + 1} ${o.player} [${o.kits.join(',')}]`).join('\n') : 'none');
      } else {
        if (!ST.queue.length) { R('Queue empty.'); break; }
        R(ST.queue.map((o, i) => `#${i + 1} Player#${o.id}: ${o.kits.join(', ')}${o.booster ? ' [BOOSTER]' : ''}`).join('\n'));
      }
      break;
    }
    case 'help': {
      const p = ['kit', 'stock', 'queue', 'help', 'restock', 'kitinfo', 'lowstock'];
      R(`Player: ${p.map(c => pre + c).join(' ')}`);
      if (isAdmin(username)) R(`Admin: ${['deliveries','addkit','removekit','setstock','give','grant','revoketokens','refund','priority','pause','resume','maintenance','bot','reconnect','home','stop','panic','stats','logs','errors','find','ad','reload','verify','unverify','cancel'].map(c=>pre+c).join(' ')}`);
      break;
    }
    case 'restock': {
      R(Object.entries(KITS).map(([k, v]) => `${k}: restock ~${v.restockMinutes}m`).join('\n')); break;
    }
    case 'kitinfo': {
      const k = a[0]; if (!k || !KITS[k]) { R('Usage: .xkitinfo <kit>'); break; }
      const v = KITS[k];
      R(`${k} Stock:${v.stock} Price:${v.price} ${v.stock>0?'AVAILABLE':'OUT'} Items: ${v.items.map(i=>i.count+'x '+i.name).join(', ')}`);
      break;
    }
    case 'lowstock': {
      R(Object.entries(KITS).filter(([k,v])=>v.stock>0&&v.stock<3).map(([k,v])=>`${k}: ${v.stock}`).join('\n') || 'none'); break;
    }

    // ---- admin ----
    case 'verify': { if (!needAdmin()) break; VERIFIED[a[0]] = VERIFIED[a[0]]||{}; VERIFIED[a[0]].booster=isBooster(a[0]); tokens(a[0]); saveVer(); saveState(); R(`Verified ${a[0]}`); break; }
    case 'unverify': { if (!needAdmin()) break; delete VERIFIED[a[0]]; saveVer(); R(`Unverified ${a[0]}`); break; }
    case 'deliveries': { if (!needAdmin()) break; R(`Active: ${current ? current.player : 'none'}\nQueue: ${ST.queue.length}`); break; }
    case 'addkit': { if (!needAdmin()) break; const k=a[0],n=+a[1]||1; if(KITS[k]){KITS[k].stock+=n;saveKits();R(`${k} +${n} = ${KITS[k].stock}`);}else R('bad kit'); break; }
    case 'removekit': { if (!needAdmin()) break; const k=a[0],n=+a[1]||1; if(KITS[k]){KITS[k].stock=Math.max(0,KITS[k].stock-n);saveKits();R(`${k} -${n} = ${KITS[k].stock}`);}else R('bad kit'); break; }
    case 'setstock': { if (!needAdmin()) break; const k=a[0],n=+a[1]; if(KITS[k]&&n!=null){KITS[k].stock=n;saveKits();R(`${k} = ${n}`);}else R('bad'); break; }
    case 'give': { if (!needAdmin()) break; const p=a[0],k=a[1]; if(!KITS[k]){R('bad kit');break;} if(KITS[k].stock<=0){R('out');break;} KITS[k].stock--; saveKits(); const o=addOrder(p,[k],true); R(`Manual delivery queued #${o.id}`); setTimeout(processQueue,500); break; }
    case 'grant': { if (!needAdmin()) break; grant(a[0], +a[1]||1); R(`${a[0]} tokens ${tokens(a[0])}`); break; }
    case 'revoketokens': { if (!needAdmin()) break; charge(a[0], +a[1]||1); R(`${a[0]} tokens ${tokens(a[0])}`); break; }
    case 'refund': { if (!needAdmin()) break; grant(a[0], +a[1]||1); R(`${a[0]} refunded, tokens ${tokens(a[0])}`); break; }
    case 'priority': { if (!needAdmin()) break; if(!a[0]){R('Usage .xpriority <player>');break;} const i=ST.boosters.indexOf(a[0]); if(i===-1){ST.boosters.push(a[0]);R('boost ON');}else{ST.boosters.splice(i,1);R('boost OFF');} saveState(); break; }
    case 'pause': { if (!needAdmin()) break; runtime.paused=true; R('Paused.'); break; }
    case 'resume': { if (!needAdmin()) break; runtime.paused=false; R('Resumed.'); break; }
    case 'maintenance': { if (!needAdmin()) break; runtime.maintenance=true; runtime.reason=a.join(' ')||'maintenance'; R(`Maintenance ON: ${runtime.reason}`); break; }
    case 'bot': { if (!needAdmin()) break; R(`Bot: ONLINE\nServer: ${CFG.host}\nPos: ${bot.entity?`${bot.entity.position.x.toFixed(1)},${bot.entity.position.y.toFixed(1)},${bot.entity.position.z.toFixed(1)}`:'?'}\nQueue: ${ST.queue.length}\nCurrent: ${current?current.player:'none'}`); break; }
    case 'reconnect': { if (!needAdmin()) break; R('reconnecting'); bot.quit('reconnect'); break; }
    case 'home': { if (!needAdmin()) break; bot.chat('/home'); R('/home sent'); break; }
    case 'stop': { if (!needAdmin()) break; if(current){refundStock(current);bot.whisper(current.player,'Delivery stopped by admin, refunded.');} current=null; bot.chat('/kill'); R('stopped'); break; }
    case 'panic': { if (!needAdmin()) break; runtime.maintenance=true; if(current)refundStock(current); current=null; saveState(); bot.quit('panic'); R('PANIC shutdown, state saved'); break; }
    case 'stats': { if (!needAdmin()) break; const s=ST.stats; R(`Today:${s.ordersToday} OK:${s.successful} Fail:${s.failed} Kits:${s.kitsDelivered} Tokens:${s.tokensCharged}`); break; }
    case 'logs': { if (!needAdmin()) break; R(ST.logs.slice(0,5).join('\n')||'none'); break; }
    case 'errors': { if (!needAdmin()) break; R(ST.errors.slice(0,5).join('\n')||'none'); break; }
    case 'find': { if (!needAdmin()) break; const o=ST.queue.find(x=>x.player===a[0]); R(o?`#${o.id} ${o.player} [${o.kits.join(',')}]`:'not in queue'); break; }
    case 'cancel': { if (!needAdmin()) break; R(removeFromQueue(a[0])?'cancelled':'not found'); break; }
    case 'ad': {
      if (!needAdmin()) break;
      const s=a[0]||'status';
      if(s==='on'){CFG.advertiser.enabled=true;R('ad on');}
      else if(s==='off'){CFG.advertiser.enabled=false;R('ad off');}
      else if(s==='now'){sendAd(true);R('ad sent');}
      else R(`Advertiser: ${CFG.advertiser.enabled?'ON':'OFF'} Last: ${ST.lastAd?Math.round((Date.now()-ST.lastAd)/60000)+'m ago':'never'}`);
      break;
    }
    case 'reload': { if (!needAdmin()) break; KITS=load('kits.json',KITS); VERIFIED=load('verified.json',VERIFIED); R('reloaded kits.json/verified.json'); break; }

    default: R(`wrong/unknown command use ${pre}help to see all command`);
  }
  return true;
}

// ---------- advertiser ----------
function sendAd(force) {
  if (!CFG.advertiser.enabled && !force) return;
  if (current || !bot?.entity || runtime.maintenance || runtime.paused) return;
  if (!force && Date.now() - ST.lastAd < CFG.advertiser.intervalMinutes * 60000) return;
  const msgs = CFG.advertiser.messages;
  bot.chat(msgs[Math.floor(Math.random() * msgs.length)]);
  ST.lastAd = Date.now(); saveState();
}
setInterval(() => sendAd(false), 60000);

// ---------- bot ----------
function mk() {
  bot = mineflayer.createBot({
    host: CFG.host, port: CFG.port, username: CFG.username,
    auth: CFG.auth, version: CFG.version, viewDistance: 'tiny'
  });
  bot.on('login', () => console.log('[login] ok'));
  bot.on('spawn', async () => {
    console.log('[spawn]', bot.entity?.position);
    await sleep(1500);
    if (CFG.password && CFG.password !== 'changeme') bot.chat(`/login ${CFG.password}`);
    await sleep(1000);
    if (CFG.autoHome) bot.chat('/home');
    processQueue();
  });
  bot.on('message', m => { const t = m.toString(); if (/dead|died|killed/i.test(t)) {} });
  bot.on('playerCollect', (c, item) => {
    if (!current) return;
    const n = c.username || c.name;
    if (!current.collectedBy) current.collectedBy = n;
  });
  bot.on('chat', (u, m) => { if (u === bot.username) return; handleCommand('chat', u, m); });
  bot.on('whisper', (u, m) => handleCommand('w', u, m));
  bot.on('error', e => { console.error('[err]', e.message); pushErr('bot: ' + e.message); });
  bot.on('end', r => { console.log('[end]', r); setTimeout(mk, 10000); });
}
mk();

// process queue tick
setInterval(() => { if (!current) processQueue(); }, 5000);
console.log('6b6t kitbot test build starting...');