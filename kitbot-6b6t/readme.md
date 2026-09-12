`README.md` — copy everything below verbatim (from the `<h1 align="center">` line down to the final Discord line) and save it as `README.md`. I can't write files to your disk directly, so this is the literal file content, with no outer wrapping fence this time — the inner ```json / ```bash blocks are part of the file.

<h1 align="center"> 6b6t KitBot — Test Build (Mineflayer) </h1>

<a href="https://www.gnu.org/licenses/gpl-3.0"><img alt="License: GPLv3" src="https://img.shields.io/badge/License-GPLv3-blue.svg?logo=gnu&logoColor=white"></a>
<a href="https://github.com/PrismarineJS/mineflayer"><img alt="Language: JavaScript" src="https://img.shields.io/badge/Language-JavaScript-informational?logo=javascript"></a>
<a href="https://discord.gg/sEMBdz86q"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white"></a>

<br> A kit-delivery bot for the **6b6t.org** anarchy server. Runs on `join.6b6t.org`, uses cracked/offline login (`xkitbotx`), delivers shulker kits via `/tpa`, charges tokens **only** after the correct player picks the items up, and advertises in chat on a 30‑minute gated timer.

> **Test build.** Discord is **stubbed** (verification is file-based, no bot token needed). Set your password and stock up the bot before real deliveries.

---

## Prerequisites

- **Node.js** (v20 or higher)
- A **Minecraft account** (offline / cracked supported — used: `xkitbotx`)
- A **Discord bot token** — *only required later to un-stub the Discord bridge* (not needed for this test build)

---

## Installation

```bash
npm install mineflayer
```

Or with the provided `package.json`:

```json
{
  "name": "6b6t-kitbot-test",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": { "start": "node index.js" },
  "dependencies": { "mineflayer": "^4.39.0" }
}
```

```bash
npm install
```

---

## Configuration

### `config.json`

Replace `YourMcName` with your **Minecraft** name (admin/owner). Set `password` for `xkitbotx`.
`version` is pinned to `1.21.11` (confirmed working on 6b6t); set `"version": false` to auto-detect.

```json
{
  "host": "join.6b6t.org",
  "port": 25565,
  "username": "xkitbotx",
  "auth": "offline",
  "password": "changeme",
  "version": "1.21.11",
  "autoHome": false,
  "prefix": ".x",
  "discordLink": "https://discord.gg/sEMBdz86q",
  "admins": ["YourMcName"],
  "owners": ["YourMcName"],
  "boosters": [],
  "startingTokens": 10,
  "kitsMax": { "normal": 3, "booster": 10, "owner": 50 },
  "cooldowns": { "home": 300, "tpa": 420, "kill": 0 },
  "advertiser": {
    "enabled": false,
    "intervalMinutes": 30,
    "messages": [
      "Need a free kit? Join https://discord.gg/sEMBdz86q → verify → get your tokens → order with .xkit. No bullshit, just kits.",
      "Running low on gear? Get a free kit from our kitbot. Join https://discord.gg/sEMBdz86q, verify, and place your order with .xkit.",
      "FREE KIT SERVICE — Verify on https://discord.gg/sEMBdz86q, receive your tokens and order directly through the bot. Check .xkit after verification.",
      "Need gear? We've got kits. Join https://discord.gg/sEMBdz86q → verify → .xkit → choose your kit.",
      "FREE KITS! Join https://discord.gg/sEMBdz86q → verify → get your tokens → order your kit with .xkit. Fast, simple, no bullshit."
    ]
  },
  "delivery": { "chunkWaitMs": 1500, "sneakMs": 1000, "pickupTimeoutMs": 10000 }
}
```

### `kits.json`

```json
{
  "starter": { "stock": 10, "price": 1, "restockMinutes": 60, "items": [{"name":"stone_sword","count":1},{"name":"bread","count":16}] },
  "diamond":  { "stock": 5,  "price": 1, "restockMinutes": 120, "items": [{"name":"diamond_sword","count":1},{"name":"diamond_helmet","count":1}] },
  "netherite":{ "stock": 2,  "price": 1, "restockMinutes": 240, "items": [{"name":"netherite_sword","count":1},{"name":"netherite_helmet","count":1}] }
}
```

### `verified.json`

```json
{}
```

Add yourself to test ordering, e.g. `{"YourMcName":{"booster":false}}`, or whisper `.xverify YourMcName` as admin.

### `state.json` (auto-created on first run)

```json
{ "tokens":{}, "queue":[], "verified":{}, "boosters":[], "stats":{"ordersToday":0,"successful":0,"failed":0,"kitsDelivered":0,"tokensCharged":0}, "logs":[], "errors":[], "lastAd":0, "nextId":1 }
```

---

## Usage

Start the bot:

```bash
node index.js
```

### Before testing delivery

1. Let `xkitbotx` join and `/login` (set `password` in `config.json`).
2. Give the bot **shulker boxes named** `starter kit`, `diamond kit`, `netherite kit` — or edit `findKitStack` in `index.js`.
3. Add your Minecraft name to `verified.json` (or use `.xverify`).
4. Whisper the bot: `.xkit diamond`.

---

## Commands Ingame

| Command | Behavior |
|---|---|
| `.xkit` | Unverified → `You're not verified. To get verified, please join https://discord.gg/sEMBdz86q`. Verified → `Kits available:` / `Out of stock:` |
| `.xkit <kit> [kit...]` | Queues order. Multi-kit = one order. Caps: normal **3** / booster **10** / owner **50** |
| `.xstock` | Per-kit stock counts |
| `.xqueue` | Queue with usernames hidden (`Player#<id>`), boosters tagged |
| `.xhelp` | Lists player + admin commands |
| `.xrestock` | Expected restock info |
| `.xkitinfo <kit>` | Contents, stock, price, status |
| `.xlowstock` | Kits under 3 in stock |

Wrong/unknown command → whisper: `wrong/unknown command use .xhelp to see all command`

---

## Admin Commands

`.xverify`, `.xunverify`, `.xdeliveries`, `.xaddkit <kit> <n>`, `.xremovekit <kit> <n>`, `.xsetstock <kit> <n>`, `.xgive <player> <kit>`, `.xgrant <player> <n>`, `.xrevoketokens <player> <n>`, `.xrefund <player> <n>`, `.xpriority <player>`, `.xpause`, `.xresume`, `.xmaintenance [reason]`, `.xbot`, `.xreconnect`, `.xhome`, `.xstop`, `.xpanic`, `.xstats`, `.xlogs`, `.xerrors`, `.xfind <player>`, `.xqueue <n>`, `.xcancel <player>`, `.xad on/off/now/status`, `.xreload`

`.xbot` output:

```
Bot: ONLINE
Server: join.6b6t.org
Pos: <x>,<y>,<z>
Queue: <n>
Current: <player|none>
```

---

## Delivery Flow

1. Whisper: `Your order is on the way. Please accept my TPA.`
2. `/tpa <player>` (respects the 420 s cooldown between orders)
3. TPA success → `TPA successful.`; deny/timeout/expire → cancelled, **no token charged**
4. Load chunks (`chunkWaitMs: 1500`)
5. Face + approach the player
6. Drop kits
7. Sneak animation (`sneakMs: 1000`)
8. Wait **5 s**
9. `/kill`

---

## Pickup Verification

Uses `playerCollect` + nearest-entity attribution (~6 blocks).

- **Correct player** → `Item picked up. 1 token charged. Token balance: <balance>`
- **Wrong player** → `You picked up another player's order. Please return it to <correct player>.`
  AND to the real buyer → `Your order was picked up by <player>. I've asked them to return it to you.`
- **Timeout / TPA fail / deny** → **no token charged**

**Token system:** 10 starting tokens; 1 token = 1 kit; charged only after correct pickup.

---

## Advertiser

- Interval: **30 minutes** (`intervalMinutes`)
- Gated on: `last_ad >= 30m` AND no active delivery AND online AND not paused/maintenance
- Persistent `lastAd` → **never double-posts on reconnect**
- **OFF by default.** Enable with `.xad on`
- Status: `.xad` → `Advertiser: ON  Interval: 30 minutes  Last ad: Xm ago`

---

## Cooldowns

| Action | Free (default) |
|---|---|
| `/home` | 300 s |
| `/tpa` | 420 s |
| `/kill` | 0 s |

Queue ETA accounts for the `/tpa` cooldown before pulling the next order.

### Prime rank

I cannot buy it (no funds). After you purchase prime, edit `config.json`:

```json
"cooldowns": { "home": 60, "tpa": 60, "kill": 0 }
```

Restart. No code change needed.

---

## Discord Commands (stubbed)

These exist **in-game** for now; the Discord bridge is stubbed until you supply a token:
`.xkitinfo`, `.xlowstock`, and all admin mirrors (`.xaddkit`, `.xgrant`, `.xpause`, `.xresume`, `.xmaintenance`, `.xbot`, `.xreconnect`, `.xhome`, `.xstop`, `.xstats`, `.xlogs`, `.xerrors`, `.xqueue <n>`, `.xfind`, `.xrefund`, `.xrevoketokens`).

To un-stub, provide: **Discord bot token**, **guild ID**, and **booster role ID**.

---

## Troubleshooting

- Ensure all dependencies are installed (`npm install`)
- Verify `config.json` values are correct (host, username, password, admins)
- Check the bot has necessary permissions / can `/login`
- Confirm the bot holds the named shulkers before delivering
- Check console for `[err]` / `[end]` messages and the `.xerrors` command

---

## Security Notes

- Keep any Discord bot token private
- Use a strong password for `/login`
- Regularly update dependencies
- **No duplication/glitch automation is included** — `.xaddkit` adjusts stock administratively

---

## Powered by Mineflayer

This project is built on top of Mineflayer, a framework for creating Minecraft bots.

- GitHub: https://github.com/PrismarineJS/mineflayer
- Docs: https://mineflayer.prismarinejs.org/
- Created and maintained by the PrismarineJS organization

---

## Credits and Dependencies

Thanks to the authors and maintainers of the libraries used in this project:

- **Mineflayer** — by PrismarineJS — https://github.com/PrismarineJS/mineflayer
- **mineflayer-pathfinder** — by PrismarineJS — *planned for pathfinding to players*
- **minecraft-data** — by PrismarineJS — https://github.com/PrismarineJS/minecraft-data
- **vec3** — by PrismarineJS — *position math*
- **discord.js** — by the Discord.js team — *planned for the Discord bridge*

---

## License

[GPL 3.0](https://www.gnu.org/licenses/gpl-3.0)

---

## Notes

All the file are ai-generate