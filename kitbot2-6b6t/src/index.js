const config = require('./config');
const store = require('./data/store');
const { createBot } = require('./bot');
const { handleMessage } = require('./commands/handler');
const { startQueueProcessor } = require('./delivery/queueProcessor');
const { createDiscordBot } = require('./discord');
const { startAdvertiser } = require('./advertiser');

const state = {
  paused: false,
  maintenance: null,
  currentDelivery: null,
  bot: null,
  logs: [],
  errors: [],
  adIndex: 0,
  advertiser: {
    enabled: config.bot.advertiserEnabled,
    lastAd: store.getLastAd(),
    intervalMs: config.bot.adIntervalMs,
  },
};

function pushLog(msg) {
  state.logs.push(msg);
  if (state.logs.length > 200) state.logs.shift();
}
function pushError(err) {
  state.errors.push({ time: Date.now(), error: err?.message || String(err) });
  if (state.errors.length > 200) state.errors.shift();
}

const botRef = {};

createBot(state, {
  onLogin(bot) {
    botRef.current = bot;
    state.bot = bot;
    pushLog(`Logged in to ${config.mc.host}`);
  },
  onSpawn(bot) {
    botRef.current = bot;
    state.bot = bot;
    bot.onlineSince = Date.now();
    pushLog('Spawned; state reloaded');
    store.reloadAll();
  },
  onDeath(bot) { pushLog('Bot died'); },
  onEnd(bot, reason) { pushLog(`Disconnected: ${reason}`); },
  onMessage(bot, username, message, source) {
    handleMessage({ bot, store, state, config, username, message, source });
  },
}, botRef);

startQueueProcessor(botRef, store, state);
startAdvertiser(botRef, store, state);

if (config.discord.token) {
  createDiscordBot({ state, botRef });
  console.log('[BOOT] Discord bot starting...');
} else {
  console.warn('[BOOT] No DISCORD_TOKEN; Discord features disabled.');
}

process.on('uncaughtException', (e) => {
  console.error('Uncaught:', e);
  pushError(e);
});

console.log('[BOOT] 6b6t kitbot fully online. Prefix:', config.bot.prefix);
