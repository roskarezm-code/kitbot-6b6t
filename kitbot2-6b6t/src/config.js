require('dotenv').config();

module.exports = {
  mc: {
    host: process.env.MC_HOST || '6b6t.org',
    port: parseInt(process.env.MC_PORT || '25565', 10),
    version: process.env.MC_VERSION || '1.20.4',
    username: process.env.MC_USERNAME || 'KitBot',
    auth: process.env.MC_AUTH || 'offline',
    password: process.env.MC_PASSWORD || undefined,
    home: {
      x: parseFloat(process.env.MC_HOME_X || 0),
      y: parseFloat(process.env.MC_HOME_Y || 64),
      z: parseFloat(process.env.MC_HOME_Z || 0),
    },
  },
  discord: {
    token: process.env.DISCORD_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
    invite: process.env.DISCORD_INVITE || '<Discord Server Link>',
    roles: {
      booster: process.env.DISCORD_BOOSTER_ROLE_ID,
      owner: process.env.DISCORD_OWNER_ROLE_ID,
      verified: process.env.DISCORD_VERIFIED_ROLE_ID,
    },
  },
  bot: {
    prefix: process.env.PREFIX || '.x',
    advertiserEnabled: process.env.ADVERTISER_ENABLED === 'true',
    adIntervalMs: parseInt(process.env.AD_INTERVAL_MS || '1800000', 10),
    dupebotEnabled: process.env.DUPEBOT_ENABLED === 'true',
    stockLocation: process.env.STOCK_LOCATION || 'ender_chest',
    restockDelayMs: parseInt(process.env.RESTOCK_DELAY_MS || '3600000', 10),
  },
  cooldowns: {
    home: parseInt(process.env.COOLDOWN_HOME || '300000', 10),
    tpa: parseInt(process.env.COOLDOWN_TPA || '420000', 10),
    kill: parseInt(process.env.COOLDOWN_KILL || '0', 10),
  },
};
