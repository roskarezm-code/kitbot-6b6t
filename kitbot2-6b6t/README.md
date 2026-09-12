# 6b6t KitBot

Mineflayer + discord.js kit-delivery bot for anarchy server `6b6t`.

## Requirements
- Node.js 18+
- A Minecraft account for the bot (offline/cracked or Microsoft, per `MC_AUTH`)
- A Discord bot application + token; the bot needs **Message Content Intent**, **Server Members Intent**, and guild access.

## Setup
1. `npm install`
2. `cp .env.example .env` and fill it (see below).
3. `node scripts/seed.js` — creates `data/*.json`.
4. Edit `data/kits.json` to your real kits/contents.
5. `npm start`

## Important environment variables
| Var | Meaning |
|---|---|
| `MC_HOST` / `MC_PORT` / `MC_VERSION` | target server + version (`1.20.4` default) |
| `MC_USERNAME` / `MC_AUTH` | bot IGN and `offline` or `microsoft` |
| `MC_HOME_X/Y/Z` | delivery base coordinates |
| `STOCK_LOCATION` | `ender_chest` (**recommended**), `home_chest`, or `inventory_shulkers` (dangerous: `/kill` drops carried stock) |
| `DISCORD_TOKEN` / `DISCORD_GUILD_ID` / `*_ROLE_ID` | Discord bot, guild, booster/owner/verified role IDs |
| `DISCORD_INVITE` | link used in verification + ads |
| `ADVERTISER_ENABLED` / `AD_INTERVAL_MS` | public-chat ads (`false` by default; `1800000` = 30m) |
| `DUPEBOT_ENABLED` / `RESTOCK_DELAY_MS` | dupebot restock stub (`false` by default, no dupe code included) |
| `COOLDOWN_HOME` / `COOLDOWN_TPA` / `COOLDOWN_KILL` | `300000` / `420000` / `0` |

## Verification flow
1. Player joins the Discord server (invite from `DISCORD_INVITE`).
2. In Discord they run `.xverify <MinecraftIGN>`.
3. Bot writes `verified[<IGN>] = { discordId, booster, owner }` and grants **10 tokens** on first verify.
4. A 60s role-sync loop keeps `booster`/`owner` flags matching Discord roles (boosters/owners get priority + 10/50 kit caps).
5. In-game the player (IGN) can now use `.xkit`.

## In-game commands (prefix `.x`)
- `.xkit` — list kits; `.xkit <kit> [kit...]` — order (role caps: normal 3, booster 10, owner 50; 1 token per kit; stock reserved on order, refunded on cancel/permanent failure).
- `.xstock` — full stock counts + restock field; `.xrestock` — expected restock ETAs.
- `.xqueue [n]` — waiting players/orders (no Discord usernames shown).
- `.xcancel <player>` — cancel + refund reserved stock.
- `.xhelp`, `.xreload`, `.xbot`, `.xfind <player>`, `.xdeliveries`.
- Admin: `.xaddkit/.xremovekit/.xsetstock`, `.xpause/.xresume/.xmaintenance`, `.xpriority`, `.xstats`, `.xlogs`, `.xerrors`.
- Advertiser: `.xad [on|off|now]`.
- Bot control: `.xreconnect`, `.xhome`, `.xstop`, `.xpanic`.
- Wrong/unknown whisper reply: `wrong/unknown command use .xhelp to see all command`.

## Discord commands
- Public: `.xverify <IGN>`, `.xkitinfo <kit>`, `.xlowstock`.
- Admin (owner role or Administrator): `.xgrant/.xrefund/.xrevoketokens`, `.xgiv <player> <kit>`, `.xpause/.xresume/.xmaintenance`, `.xpriority`, `.xbot`, `.xreconnect`, `.xhome`, `.xstop`, `.xpanic`, `.xdeliveries`, `.xstats`, `.xlogs`, `.xerrors`, `.xqueue <n>`, `.xfind <player>`, `.xad ...`.

## Delivery / tokens
Order → queue (priority FIFO for boosters/owners) → `/home` (300s cd) → withdraw kit from storage → whisper + `/tpa <player>` (420s cd) → chunk load → path to player + face → drop kits → sneak → 5s wait → `/kill`.
Tokens are charged **only** when the **correct player** picks the item up (`playerCollect`). TPA deny/timeout/failure does **not** charge; order retries 3× (60s apart) then is cancelled and stock refunded. `.xlogs`/`.xerrors`/`.xstats` track outcomes.

## Advertiser
Evaluates every minute; sends **only** if: enabled, bot online/spawned, no maintenance, no active delivery, not on `/home`/`/tpa` cooldown, and `now - lastAd >= AD_INTERVAL_MS`. Last ad time is persisted in `data/ads.json`, so **reconnects never re-spam**. Ads rotate through the six provided templates with `<DISCORD_LINK>` replaced by `DISCORD_INVITE`.

## Persistence & recovery
All state (kits, verified, tokens, queue, stats, ads) is JSON in `data/`. `createBot` refreshes `botRef.current` on every reconnect, so the queue processor and advertiser always act on the live bot. Queued orders, stock, tokens, and verification survive disconnects.

## Note on dupebot
`DUPEBOT_ENABLED=false` by default and `src/dupe/index.js` contains **no duplication/glitch code** — it is a stub interface only. Restocking works as a manual/operator stock add. Do not enable it unless you accept your server’s rules; the flag exists so the feature can be turned off without touching the rest.

## Note bonus
its all made by ai 

## 🚀 Powered By & Support

This project leverages [xKiro](https://xkiro.com/ref/7N2RAQH) to [insert brief description of what xKiro does, e.g., optimize workflows / manage deployments]. 

If you want to try it out or scale your own infrastructure, consider signing up through our link to support this project:
👉 **[Get Started on xKiro](https://xkiro.com/ref/7N2RAQH)**
