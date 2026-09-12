const config = require('../config');

const KNOWN = [
  'kit','help','stock','queue','cancel','reload','bot','addkit','removekit','setstock',
  'pause','resume','maintenance','priority','reconnect','home','stop','panic',
  'deliveries','stats','logs','errors','find','ad','restock'
];

function isKnownCommand(trimmed, prefix) {
  if (!trimmed.startsWith(prefix)) return false;
  const cmd = trimmed.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
  return KNOWN.includes(cmd);
}

function reply(bot, player, msg) { bot.chat(`/w ${player} ${msg}`); }

function handleMessage(ctx) {
  const { bot, store, state, username, message, source } = ctx;
  const prefix = config.bot.prefix;
  const trimmed = message.trim();

  if (source === 'whisper' && !isKnownCommand(trimmed, prefix)) {
    reply(bot, username, 'wrong/unknown command use .xhelp to see all command');
    return;
  }
  if (!trimmed.startsWith(prefix)) return;

  const args = trimmed.slice(prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  switch (cmd) {
    case 'kit': return cmdKit(ctx, args);
    case 'help': return cmdHelp(ctx);
    case 'stock': return cmdStock(ctx);
    case 'queue': return cmdQueue(ctx, args);
    case 'cancel': return cmdCancel(ctx, args);
    case 'reload': return cmdReload(ctx);
    case 'bot': return cmdBot(ctx);
    case 'addkit': return cmdAddKit(ctx, args);
    case 'removekit': return cmdRemoveKit(ctx, args);
    case 'setstock': return cmdSetStock(ctx, args);
    case 'pause':
      state.paused = true;
      return reply(bot, username, 'New orders paused. Current delivery will finish.');
    case 'resume':
      state.paused = false;
      state.maintenance = null;
      return reply(bot, username, 'Ordering resumed.');
    case 'maintenance':
      state.maintenance = args.join(' ') || 'enabled';
      return reply(bot, username, `Maintenance mode ON: ${state.maintenance}`);
    case 'priority': return cmdPriority(ctx, args);
    case 'reconnect':
      reply(bot, username, 'Reconnecting...');
      return bot.end('manual reconnect');
    case 'home':
      reply(bot, username, 'Returning home (/home).');
      return require('../bot').ensureHome(bot);
    case 'stop':
      if (state.currentDelivery) state.currentDelivery.abort = true;
      state.currentDelivery = null;
      return reply(bot, username, 'Current delivery stopped safely.');
    case 'panic':
      state.paused = true;
      state.maintenance = 'emergency';
      store.saveQueueState();
      reply(bot, username, 'PANIC: saving state and disconnecting.');
      return bot.end('panic');
    case 'deliveries':
      if (!state.currentDelivery) return reply(bot, username, 'No active delivery.');
      return reply(bot, username, `Active: ${state.currentDelivery.player} -> ${state.currentDelivery.kits.join(', ')}`);
    case 'stats': return cmdStats(ctx);
    case 'logs':
      state.logs.slice(-5).forEach(l => reply(bot, username, `[log] ${l}`));
      return;
    case 'errors':
      state.errors.slice(-5).forEach(e => reply(bot, username, `[err] ${e.error || e}`));
      return;
    case 'find': return cmdFind(ctx, args);
    case 'restock': return cmdRestock(ctx);
    case 'ad': {
      const advertiser = require('../advertiser');
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'on') {
        state.advertiser.enabled = true;
        return reply(bot, username, 'Advertiser ON');
      }
      if (sub === 'off') {
        state.advertiser.enabled = false;
        return reply(bot, username, 'Advertiser OFF');
      }
      if (sub === 'now') {
        advertiser.sendAd(bot, state).catch(() => {});
        return reply(bot, username, 'Ad sent now.');
      }
      const adv = state.advertiser;
      const last = store.getLastAd();
      const since = last ? Date.now() - last : Infinity;
      const remain = isFinite(since) ? Math.max(0, adv.intervalMs - since) : adv.intervalMs;
      reply(bot, username, `Advertiser: ${adv.enabled ? 'ON' : 'OFF'}`);
      reply(bot, username, `Interval: ${Math.floor(adv.intervalMs / 60000)} minutes`);
      reply(bot, username, `Last ad: ${last ? Math.floor(since / 60000) + 'm ago' : 'never'}`);
      if (adv.enabled) reply(bot, username, `Next ad: ~${Math.floor(remain / 60000)}m`);
      return;
    }
    default:
      return reply(bot, username, 'wrong/unknown command use .xhelp to see all command');
  }
}

function getQueuePosition(store, entry) {
  const q = [...store.getQueue()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
  return q.findIndex(e => e.id === entry.id) + 1;
}

function cmdKit(ctx, args) {
  const { bot, store, state, username } = ctx;
  const player = username;

  if (!store.isVerified(player)) {
    return reply(bot, player, `You're not verified. To get verified, please join ${config.discord.invite}.`);
  }
  if (args.length === 0) {
    const kits = store.getKits();
    const available = [], out = [];
    for (const [name, data] of Object.entries(kits)) {
      if (data.stock > 0) available.push(name); else out.push(name);
    }
    reply(bot, player, `Kits available: ${available.join(', ') || 'none'}`);
    reply(bot, player, `Out of stock: ${out.join(', ') || 'none'}`);
    return;
  }

  if (state.maintenance) return reply(bot, player, `Ordering disabled (maintenance): ${state.maintenance}`);
  if (state.paused) return reply(bot, player, 'New orders are paused. Try again later.');

  const role = store.isOwner(player) ? 'owner' : store.isBooster(player) ? 'booster' : 'normal';
  const caps = { normal: 3, booster: 10, owner: 50 };
  const cap = caps[role];
  if (args.length > cap) return reply(bot, player, `Your role (${role}) can order max ${cap} kits per order.`);

  const kits = store.getKits();
  const unknown = args.filter(k => !kits[k]);
  if (unknown.length) return reply(bot, player, `Unknown kit(s): ${unknown.join(', ')}`);

  const counts = {};
  args.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
  for (const [kit, n] of Object.entries(counts)) {
    if ((kits[kit]?.stock ?? 0) < n) {
      return reply(bot, player, `Not enough stock for ${kit}. Requested ${n}, have ${kits[kit]?.stock ?? 0}.`);
    }
  }

  const balance = store.getTokens(player);
  if (balance < args.length) {
    return reply(bot, player, `Not enough tokens. Need ${args.length}, balance: ${balance}. Ask an admin for .xgrant.`);
  }

  for (const [kit, n] of Object.entries(counts)) store.removeKitStock(kit, n);

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    player, kits: args, priority: role !== 'normal', createdAt: Date.now(), attempts: 0,
  };
  store.addToQueue(entry);
  store.incStat('ordersToday', 1);

  const pos = getQueuePosition(store, entry);
  reply(bot, player, `You're in the queue. Please wait. Queue: ${pos}`);
}

function cmdHelp(ctx) {
  const { bot, username } = ctx;
  [
    '--- KitBot Commands (.x) ---',
    '.xkit -> list kits | .xkit <kit> [kit...] -> order',
    '.xstock -> full stock counts | .xrestock -> restock ETA',
    '.xqueue [n] -> waiting players/orders',
    '.xcancel <player> -> cancel + refund stock',
    '.xreload -> reload kits.json/verified.json',
    '.xbot -> status | .xhelp -> this list',
    'Admin: .xaddkit/.xremovekit/.xsetstock <kit> <amount>',
    'Admin: .xpause/.xresume/.xmaintenance [reason] | .xpriority <player>',
    'Admin: .xstats | .xlogs | .xerrors | .xfind <player> | .xdeliveries',
    'Control: .xreconnect | .xhome | .xstop | .xpanic',
    'Advertiser: .xad [on|off|now]',
    'Discord: .xverify <IGN> | .xkitinfo <kit> | .xlowstock',
    'Discord admin: .xgrant/.xrefund/.xrevoketokens/.xgiv/.xad/.xqueue/.xfind/.xbot ...',
    'Wrong command -> "wrong/unknown command use .xhelp to see all command"',
  ].forEach(l => reply(bot, username, l));
}

function cmdStock(ctx) {
  const { bot, store, username } = ctx;
  const entries = Object.entries(store.getKits());
  if (!entries.length) return reply(bot, username, 'No kits configured.');
  entries.forEach(([name, data]) => {
    const restock = data.restockAt ? new Date(data.restockAt).toISOString() : 'unknown';
    reply(bot, username, `${name}: Stock=${data.stock}, Price=${data.price ?? 1} token(s), Restock=${restock}`);
  });
}

function cmdQueue(ctx, args) {
  const { bot, store, username } = ctx;
  const q = [...store.getQueue()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
  const n = parseInt(args[0], 10) || 10;
  q.slice(0, n).forEach((e, i) =>
    reply(bot, username, `#${i + 1} ${e.player} -> ${e.kits.join(', ')}${e.priority ? ' [PRIORITY]' : ''}`));
  if (!q.length) reply(bot, username, 'Queue is empty.');
}

function cmdCancel(ctx, args) {
  const { bot, store, username } = ctx;
  const target = (args[0] || '').toLowerCase();
  if (!target) return reply(bot, username, 'Usage: .xcancel <player>');
  const before = store.getQueue();
  const removed = before.filter(e => e.player.toLowerCase() === target);
  const remaining = before.filter(e => e.player.toLowerCase() !== target);
  removed.forEach(e => {
    const counts = {};
    e.kits.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
    Object.entries(counts).forEach(([kit, n]) => store.addKitStock(kit, n));
  });
  store.setQueue(remaining);
  reply(bot, username, `Cancelled ${removed.length} order(s) for ${target}. Reserved stock refunded.`);
}

function cmdReload(ctx) {
  const { bot, store, username } = ctx;
  store.reloadAll();
  reply(bot, username, 'Reloaded kits.json and verified.json from disk.');
}

function cmdBot(ctx) {
  const { bot, store, username, state } = ctx;
  const up = bot.onlineSince ? Math.floor((Date.now() - bot.onlineSince) / 1000) : 0;
  const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60);
  reply(bot, username, 'Bot: ONLINE');
  reply(bot, username, `Server: ${config.mc.host}`);
  reply(bot, username, `Position: ${bot.entity ? bot.entity.position.toString() : 'unknown'}`);
  reply(bot, username, `Queue: ${store.getQueue().length}`);
  reply(bot, username, `Current delivery: ${state.currentDelivery ? state.currentDelivery.player : 'none'}`);
  reply(bot, username, `Uptime: ${h}h ${m}m`);
}

function cmdAddKit(ctx, args) {
  const { bot, store, username } = ctx;
  const kit = args[0];
  const amt = parseInt(args[1], 10);
  if (!kit || isNaN(amt)) return reply(bot, username, 'Usage: .xaddkit <kit> <amount>');
  if (!store.getKit(kit)) return reply(bot, username, `Unknown kit: ${kit}`);
  if (config.bot.dupebotEnabled) {
    require('../dupe').restock(kit, amt)
      .then(() => reply(bot, username, `Dupebot restock done: +${amt} ${kit}. Stock now ${store.getKit(kit)?.stock}.`))
      .catch(e => reply(bot, username, `Dupebot failed: ${e.message}`));
  } else {
    store.addKitStock(kit, amt);
    reply(bot, username, `Added ${amt} x ${kit} (manual, dupebot disabled). Stock now ${store.getKit(kit)?.stock}.`);
  }
}

function cmdRemoveKit(ctx, args) {
  const { bot, store, username } = ctx;
  const kit = args[0];
  const amt = parseInt(args[1], 10);
  if (!kit || isNaN(amt)) return reply(bot, username, 'Usage: .xremovekit <kit> <amount>');
  store.removeKitStock(kit, amt);
  reply(bot, username, `Removed ${amt} x ${kit}. Stock now ${store.getKit(kit)?.stock ?? 0}.`);
}

function cmdSetStock(ctx, args) {
  const { bot, store, username } = ctx;
  const kit = args[0];
  const amt = parseInt(args[1], 10);
  if (!kit || isNaN(amt)) return reply(bot, username, 'Usage: .xsetstock <kit> <amount>');
  store.setKitStock(kit, amt);
  reply(bot, username, `Set ${kit} stock to ${amt}.`);
}

function cmdPriority(ctx, args) {
  const { bot, store, username } = ctx;
  const target = args[0];
  if (!target) return reply(bot, username, 'Usage: .xpriority <player>');
  const v = store.getVerified()[target];
  if (!v) return reply(bot, username, 'Player not verified.');
  v.booster = !v.booster;
  store.setVerified(target, v);
  reply(bot, username, `${target} priority(booster) = ${v.booster}`);
}

function cmdStats(ctx) {
  const { bot, store, username } = ctx;
  const s = store.getStats();
  reply(bot, username, `Orders today: ${s.ordersToday}`);
  reply(bot, username, `Successful: ${s.successful}`);
  reply(bot, username, `Failed: ${s.failed}`);
  reply(bot, username, `Kits delivered: ${s.kitsDelivered}`);
  reply(bot, username, `Tokens charged: ${s.tokensCharged}`);
}

function cmdFind(ctx, args) {
  const { bot, store, username } = ctx;
  const target = (args[0] || '').toLowerCase();
  if (!target) return reply(bot, username, 'Usage: .xfind <player>');
  const entry = store.getQueue().find(e => e.player.toLowerCase() === target);
  if (!entry) return reply(bot, username, `${target} has no active queued order.`);
  reply(bot, username, `${target}: queue #${getQueuePosition(store, entry)}, kits=${entry.kits.join(',')}, priority=${entry.priority}`);
}

function cmdRestock(ctx) {
  const { bot, store, username } = ctx;
  const entries = Object.entries(store.getKits());
  if (!entries.length) return reply(bot, username, 'No kits configured.');
  entries.forEach(([n, d]) => {
    let when;
    if (d.restockAt) {
      when = new Date(d.restockAt).toISOString();
    } else if (d.stock <= 0) {
      if (config.bot.dupebotEnabled) {
        const eta = Date.now() + config.bot.restockDelayMs;
        store.setKitField(n, 'restockAt', eta);
        when = new Date(eta).toISOString() + ' (dupebot scheduled)';
      } else {
        when = 'unknown (dupebot disabled)';
      }
    } else {
      when = 'in stock, no restock needed';
    }
    reply(bot, username, `${n}: stock=${d.stock}, expected restock=${when}`);
  });
}

module.exports = { handleMessage };
