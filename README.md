# Claude Analyzer

A self-hosted Nuxt dashboard for your Claude Code usage: tokens, estimated cost, models, projects, sessions, tools and activity patterns. It can also show your Console organization's real API billing.

**Deploying on Portainer/Docker → see [DEPLOYMENT.md](./DEPLOYMENT.md).**

## What you get

- **Overview**: estimated cost at API list prices, total/output/thinking tokens, API calls, sessions, prompts, tool calls, cache hit rate, money saved by prompt caching, deltas vs the previous period, daily tokens/cost/calls, cost by model and project, token mix, top tools
- **Models**: daily cost/tokens per model, per-model table (cache hit rate, $/call, avg output), effort levels, stop reasons, fast vs standard speed, Claude Code versions
- **Projects**: per-project cost, sessions, prompts, tool calls, main model, last activity, daily cost by project. Click a row to filter the whole dashboard
- **Sessions**: searchable list with title, duration, prompts, tools, tokens and cost. The detail page shows context size per call, cumulative cost, models, tools and every API call
- **Tools**: calls, error rates, subagent usage, MCP servers, slash commands, server-side web search/fetch
- **Activity**: 365-day calendar, day × hour heatmap (calls, prompts, cost), hour-of-day profile, streaks, busiest and priciest day, session length
- **API organization** (optional): real usage and cost from the Anthropic Usage & Cost Analytics API (Admin key)
- Global date range (7D/30D/90D/YTD/All/custom) and project filter, kept in the URL; light/dark theme

## How data gets in

Claude Code logs every session to `~/.claude/projects/**/*.jsonl`. The server either:

1. **scans a mounted folder** (`CLAUDE_PROJECTS_DIR`), incrementally reading only new bytes, or
2. **receives pushes** from `scripts/sync.mjs` running on your PC (`POST /api/ingest` with `INGEST_TOKEN`).

Both use the same parser (`lib/claude-log.mjs`). Each message's usage is deduplicated by message id, since Claude Code logs one line per content block. Each session is attributed to the folder it was started in. Only numbers and names are kept, never prompt or response text.

## Run locally

```bash
npm install
cp .env.example .env         # set CLAUDE_PROJECTS_DIR=~/.claude/projects (absolute path), DATA_DIR=./.data
npm run dev                   # http://localhost:3000
# or production build
npm run build && node .output/server/index.mjs
```

Requires Node.js ≥ 22.13 (uses the built-in `node:sqlite`; no native modules).

## Stack

Nuxt 4 (SPA) + Nitro server routes · SQLite via `node:sqlite` · ECharts (`vue-echarts`) · `@anthropic-ai/sdk` for the Admin analytics API.

## Notes on cost estimates

Costs come from `pricing.json` (list prices per million tokens, cache write 1.25× for the 5-minute TTL or 2× for 1 hour, model-specific cache-read prices, fast-mode multiplier). On a Pro/Max subscription you are not billed per token. The numbers show what the same usage would cost on the API, which is useful for seeing which projects and models consume the most. Edit the file or point `PRICING_FILE` at your own copy; history is re-priced at startup.
