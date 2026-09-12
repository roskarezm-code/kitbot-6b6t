# 6b6t KitBot — Requirements & Design

> Specification document generated from the original project prompt.
> **Server:** `6b6t`  •  **Command prefix:** `.x`  •  **Style:** Discord-verified kit delivery bot.

## Overview

A Minecraft kit-delivery bot for the anarchy server **6b6t**. It manages:

- Player verification (linked to a Discord server),
- Kit ordering with a delivery queue (boosters/owners get priority),
- A token economy (1 token = 1 kit),
- TPA-based delivery with chunk loading, facing, dropping, sneak animation and `/kill`,
- Item-pickup verification (correct vs. wrong player),
- Automatic reconnect + return-to-home recovery,
- Cooldown-aware delivery scheduling,
- A 30-minute gated public-chat advertiser.

---

## Prefix

All commands use the prefix `.x`.

Examples:

```
.xkit
.xkit diamond
.xstock
.xqueue
.xhelp
```

---

## 1. Verification

- `.xkit` is the **main kit-order command**.

**If a player is NOT verified**, reply:

```
You're not verified. To get verified, please join <Discord Server Link>.
```

**If a player IS verified**, show:

```
Kits available: <kit>, <kit>, <kit>
Out of stock: <kit>, <kit>, <kit>
```

**If already verified**, they may order using:

```
.xkit <kit>
```

---

## 2. Ordering & Queue

- `.xkit <kit>` places the player in the **delivery queue**.
- Multiple kits in one command are processed as **one order**:
  ```
  .xkit <kit> <kit> <kit>
  ```

### Per-order kit caps (by role)

| Role | Max kits per order |
|---|---|
| Normal player | 3 |
| Discord Booster | 10 |
| Owner | 50 |

- When an order is accepted, reply using `/w` or `/whisper`:
  ```
  You're in the queue. Please wait. Queue: <number>
  ```
- **Discord boosters receive priority delivery** and bypass the normal queue when possible (they are moved ahead of non-priority orders).
- `.xqueue` shows **who is waiting and what they ordered**, but **must not show Discord usernames or other private user information** (show Minecraft IGNs and kits only).

---

## 3. Token System

- Each **verified** player receives **10 tokens**.
- **1 token = 1 kit**.
- Tokens are charged **only after a successful TPA and successful delivery**.
- If TPA is **denied, times out, or fails**, **do not charge a token**.
- Token balances must stay **synchronized with the Discord verification/order system**.

Charging confirmation whisper (correct pickup):

```
Item picked up. 1 token charged. Token balance: <balance>
```

---

## 4. Delivery Process

When the player’s order reaches **queue position 0**:

1. Whisper to the player:
   ```
   Your order is on the way. Please accept my TPA.
   ```
2. Send:
   ```
   /tpa <player>
   ```
3. After TPA succeeds, whisper:
   ```
   TPA successful.
   ```
4. Wait for the bot to finish **loading the surrounding chunks**.
5. **Move toward and face** the ordering player.
6. **Drop all requested kits**.
7. After dropping the items, perform a **short friendly sneak animation**.
8. **Wait 5 seconds** after the friendly animation.
9. Then use:
   ```
   /kill
   ```

---

## 5. Item Pickup Verification

After dropping the items, verify that the **correct player** picked them up.

- If multiple players are nearby, **follow the player who placed the order**.
- **Correct player picks up** → whisper:
  ```
  Item picked up. 1 token charged. Token balance: <balance>
  ```
- **Another player picks up the order** → whisper to the **wrong player**:
  ```
  You picked up another player's order. Please return it to <correct player>.
  ```
- At the same time, whisper to the **correct player**:
  ```
  Your order was picked up by <player>. I've asked them to return it to you.
  ```

---

## 6. Bot Recovery

If the bot disconnects:

- **Automatically reconnect** using the configured Minecraft client.
- **Automatically authenticate** with the server’s supported login mechanism.
- After reconnecting, **return to the configured home/base location**.
- Must **not lose**: queued orders, stock data, token balances, or verification data after a disconnect.

---

## 7. Cooldowns

| Command / Action | Cooldown |
|---|---|
| `/home` | 300 seconds |
| `/tpa` | 420 seconds |
| `/kill` | no cooldown |

The **queue system must account for these cooldowns** when estimating delivery times.

---

## 8. Discord Boosters

If someone **boosts the Discord server**, prefer them first and **let them bypass the queue** so they are served faster (priority role → priority queue entry and faster delivery).

---

# Command Reference

## Player / Command-code commands

| Command | Description |
|---|---|
| `.xkit` | Show all kits and stock numbers. |
| `.xstock` | Dump **full stock counts for every kit** (not just the available/out-of-stock split players see) and **estimate when restock**. |
| `.xqueue` | See who is waiting and what they ordered (**no Discord usernames / private info**). |
| `.xcancel <player>` | Pull someone’s order out of the queue and **refund the reserved stock** (e.g. they went offline). |
| `.xreload` | Reload `kits.json` / `verified.json` from disk, so hand-edits apply without restarting the bot. |
| `.xhelp` | List all admin commands in-game. |
| `.xrestock` | Show expected restock information. |

> **Unknown / wrong command behavior:** if a player uses a wrong/unknown command while whispering, always reply:
> ```
> wrong/unknown command use .xhelp to see all command
> ```

## Admin commands

| Command | Description |
|---|---|
| `.xdeliveries` | Show active deliveries. |
| `.xaddkit <kit> <amount>` | Add stock by using the **dupe bot** — the dupe bot gets the backup shulker and dupes it. |
| `.xremovekit <kit> <amount>` | Remove stock. |
| `.xsetstock <kit> <amount>` | Set exact stock. |
| `.xgiv <player> <kit>` | Admin/manual delivery. (**include Discord admin command**) |
| `.xgrant <player> <tokens>` | Give tokens. (**include Discord admin command**) |
| `.xrevoketokens <player> <amount>` | Remove tokens. (**include Discord admin command**) |
| `.xrefund <player> <amount>` | Manual refund. (**include Discord admin command**) |
| `.xpriority <player>` | View/change priority status. |
| `.xpause` | Pause new orders while allowing current delivery to finish. (**include Discord admin command**) |
| `.xresume` | Resume ordering. (**include Discord admin command**) |
| `.xmaintenance` | Temporarily disable ordering with a reason. (**include Discord admin command**, and might get free token) |

## Discord commands

| Command | Description |
|---|---|
| `.xkitinfo <kit>` | Show what is inside the shulker — item list. Example output: `.xkitinfo diamond, Stock: 42, Price: 1 token, Status: AVAILABLE` |
| `.xlowstock` | Show kits approaching low stock. |

## Bot control commands

| Command | Description |
|---|---|
| `.xbot` | Show bot status (**include Discord admin command**). |
| `.xreconnect` | Reconnect the bot. (**include Discord admin command**) |
| `.xhome` | Return bot to its configured home/base. (**include Discord admin command**) |
| `.xstop` | Stop the current delivery safely. (**include Discord admin command**) |
| `.xpanic` | Emergency shutdown. |

`.xbot` status format:

```
Bot: ONLINE
Server: 6b6t
Position: ...
Queue: 4
Current delivery: Player123
Uptime: 3h 42m
```

`.xpanic` — Emergency shutdown steps:

1. Stop accepting orders
2. Stop advertising
3. Cancel active automation
4. Save queue/stock state
5. Disconnect bot

## Useful admin information commands

| Command | Description |
|---|---|
| `.xstats` | Show stats (**include Discord admin command**). |
| `.xlogs` | Show recent delivery events (**include Discord admin command**). |
| `.xerrors` | Show recent failures (**include Discord admin command**). |
| `.xqueue <number>` | Show a specific range of queue entries (**include Discord admin command**). |
| `.xfind <player>` | Find a player’s order/status (**include Discord admin command**). |

`.xstats` output example:

```
Orders today: 43
Successful: 39
Failed: 4
Kits delivered: 71
Tokens charged: 71
```

`.xerrors` should report recent failures such as:

- TPA timeout
- TPA denied
- Bot disconnected
- Kit unavailable
- Player offline

---

# Advertiser Behavior

Every **30 minutes**, the bot checks:

1. **Is there an active order?**
   - Yes → prioritize the player/order message.
   - The **advertiser waits until the interaction is finished**.
2. **Is the bot disconnected?**
   - Do **not** advertise.
3. **Is the bot in cooldown/maintenance?**
   - Do **not** advertise.
4. **Otherwise:**
   - Send **one** advertisement in public chat.
5. **Never send the advertisement repeatedly because of reconnects** — track the **last advertisement timestamp**.

## Advertise templates

```text
Need a free kit? Join our Discord, verify your account, claim your tokens and order your kit directly from the bot. Simple, fast, no bullshit. Join: <DISCORD_LINK>
```

```text
FREE KITS! Join <DISCORD_LINK> → verify → get your tokens → order your kit with .xkit. Fast, simple, no bullshit.
```

*ad 1*

```text
Need a free kit? Join <DISCORD_LINK> → verify → get your tokens → order with .xkit. No bullshit, just kits.
```

*ad 2*

```text
Running low on gear? Get a free kit from our kitbot. Join <DISCORD_LINK>, verify, and place your order with .xkit.
```

*ad 3*

```text
FREE KIT SERVICE — Verify on <DISCORD_LINK>, receive your tokens and order directly through the bot. Check .xkit after verification.
```

*ad 4*

```text
Need gear? We've got kits. Join <DISCORD_LINK> → verify → .xkit → choose your kit.
```

## Priority logic (advertiser)

```text
ACTIVE PLAYER ORDER
        ↓
  Finish interaction
        ↓
   Delivery complete
        ↓
   Wait if necessary
        ↓
Advertisement timer
        ↓
     Send ad
```

### Send-ad rule

```
last_advertisement >= 30 minutes
AND
no active delivery
AND
bot online
AND
not in maintenance
→ advertise
```

## `.xad` admin commands

Show advertiser status:

```text
Advertiser: ON
Interval: 30 minutes
Last ad: 12m ago
Next ad: ~18m
```

Controls:

```text
.xad on
.xad off
.xad now
```

---

# Reference Implementations

Advanced / reference projects used as inspiration:

1. https://github.com/Upcast132/Kitbot-for-8b8t
2. https://github.com/CubeBeveled/6b6t-advertising
3. https://github.com/VeryBigSad/unnamedBot
4. https://github.com/ImaNimrod/nimex-mc/blob/master/src/deliveryBot.js

The advertiser logic is modeled after: https://github.com/CubeBeveled/6b6t-advertising

---

# Exact reply strings (must match)

```text
You're not verified. To get verified, please join <Discord Server Link>.
```

```text
You're in the queue. Please wait. Queue: <number>
```

```text
Your order is on the way. Please accept my TPA.
```

```text
TPA successful.
```

```text
Item picked up. 1 token charged. Token balance: <balance>
```

```text
You picked up another player's order. Please return it to <correct player>.
```

```text
Your order was picked up by <player>. I've asked them to return it to you.
```

```text
wrong/unknown command use .xhelp to see all command
```

---

# Summary of hard rules

- Prefix is always `.x`.
- Verified players start with **10 tokens**; **1 token = 1 kit**.
- Tokens are deducted **only** after successful TPA **and** correct-player pickup.
- Order caps: normal **3**, booster **10**, owner **50**.
- Boosters/owners bypass/prioritize the queue.
- Reserved stock is refunded when an order is cancelled (`.xcancel`) or permanently fails.
- Cooldowns: `/home` 300s, `/tpa` 420s, `/kill` none; queue estimates must respect them.
- Bot must survive reconnects without losing queue, stock, tokens, or verification.
- Advertiser is gated: no ad while an order is active, while disconnected, during maintenance/cooldown, or within 30 minutes of the last ad.
