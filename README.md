# ClickUp Discord Bot (Cloudflare Worker)

Single-file Cloudflare Worker that connects Discord slash commands to ClickUp: create tasks, search, and announce in a channel.

## Setup

1. **Install and run locally**
   ```bash
   npm install
   npm run dev
   ```

2. **Set secrets** (after `wrangler login`):
   ```bash
   wrangler secret put DISCORD_PUBLIC_KEY
   wrangler secret put CLICKUP_TOKEN
   wrangler secret put LIST_ID
   wrangler secret put DISCORD_BOT_TOKEN
   wrangler secret put DISCORD_CHANNEL_ID
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

4. **Discord**: Set your bot’s “Interactions Endpoint URL” to your Worker URL (e.g. `https://clickup-discord-bot.<your-subdomain>.workers.dev`).

## Commands

- **`/task`** – Create a ClickUp task and announce it in the configured channel.
- **`/tasksilent`** – Create a task without announcing.
- **`/clickup`** – Open a task by ID (with autocomplete from the list).

All logic lives in **`worker.js`**.
