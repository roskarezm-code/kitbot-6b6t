case 'ad': {
  if (!admin) return reply(msg, 'Admin only.');
  const advertiser = require('../advertiser');
  const sub = (args[0] || '').toLowerCase();
  if (sub === 'on') {
    state.advertiser.enabled = true;
    return reply(msg, 'Advertiser ON');
  }
  if (sub === 'off') {
    state.advertiser.enabled = false;
    return reply(msg, 'Advertiser OFF');
  }
  if (sub === 'now') {
    const b = botRef.current;
    if (b && b.spawned) advertiser.sendAd(b, state).catch(() => {});
    return reply(msg, 'Ad sent now.');
  }
  const adv = state.advertiser;
  const last = store.getLastAd();
  const since = last ? Date.now() - last : Infinity;
  const remain = isFinite(since) ? Math.max(0, adv.intervalMs - since) : adv.intervalMs;
  return reply(msg,
    `Advertiser: ${adv.enabled ? 'ON' : 'OFF'}\n` +
    `Interval: ${Math.floor(adv.intervalMs / 60000)} minutes\n` +
    `Last ad: ${last ? Math.floor(since / 60000) + 'm ago' : 'never'}` +
    (adv.enabled ? `\nNext ad: ~${Math.floor(remain / 60000)}m` : ''));
}
