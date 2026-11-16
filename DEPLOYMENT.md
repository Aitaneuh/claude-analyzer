# Deploying Claude Analyzer on Portainer

This guide goes from zero to a running dashboard on your server, with your PC sending its Claude Code usage to it automatically.

---

## 0. How the pieces fit

```
 Your PC (where you run Claude Code)              Your server (Portainer / Docker)
 ┌────────────────────────────────────┐            ┌──────────────────────────────────┐
 │ ~/.claude/projects/**/*.jsonl      │            │ claude-analyzer container         │
 │        │                           │  HTTPS     │  ├─ POST /api/ingest  (token)     │
 │        ▼                           │ ─────────► │  ├─ SQLite in volume /data        │
 │ node scripts/sync.mjs  (every 5m)  │            │  └─ dashboard on :3000            │
 └────────────────────────────────────┘            └──────────────────────────────────┘
```

Claude Code writes one JSONL log per session in `~/.claude/projects` (Windows: `C:\Users\<you>\.claude\projects`). The dashboard needs those files. There are two ways to get them to it:

| Mode | When to use | What you configure |
|---|---|---|
| **Push (recommended)** | The server isn't the machine where you use Claude Code | `INGEST_TOKEN` on the server + the sync script on your PC |
| **Folder mount** | Claude Code runs on the Docker host itself | A read-only bind mount of `~/.claude/projects` to `/claude/projects` |

You can use both at once (several PCs pushing, and the host mounted). Records are deduplicated, so sending the same data twice is harmless.

**Privacy:** only token counts, model ids, timestamps, project *folder names*, tool names and prompt *lengths* are stored. Prompt and response text is never stored or sent.

---

## 1. Get the image onto your server

Pick **one** option.

### Option A: Portainer builds it from your Git repo (easiest)

1. Push this project to a Git repository (GitHub, GitLab, Gitea...). A private repo works; Portainer asks for a token.
2. Portainer → **Stacks** → **+ Add stack** → name it `claude-analyzer` → **Build method: Repository**.
3. Repository URL: `https://github.com/<you>/claude-analyzer`, reference `refs/heads/main`, compose path `docker-compose.yml`.
   For a private repo, turn on **Authentication** and enter your username and a personal access token.
4. Go straight to **step 2** below to fill in the environment variables, then **Deploy the stack**.
   Portainer runs `docker compose up --build`, so the first deploy takes 1-3 minutes.

To update later: push to Git, then open the stack → **Pull and redeploy** (tick *Re-pull image and redeploy*).

### Option B: build on your PC, push to a registry

```bash
# Docker Hub example. For GHCR use ghcr.io/<you>/claude-analyzer
docker build -t <dockerhub-user>/claude-analyzer:latest .
docker push <dockerhub-user>/claude-analyzer:latest
```

If your server's CPU differs from your PC's (for example a Raspberry Pi on ARM), build for it:
`docker buildx build --platform linux/arm64,linux/amd64 -t <user>/claude-analyzer:latest --push .`

Then in Portainer → **Stacks** → **+ Add stack** → **Web editor**, paste `docker-compose.yml`, **delete the `build: .` line**, and add a variable `IMAGE=<dockerhub-user>/claude-analyzer:latest` in step 2.

### Option C: build directly on the server over SSH

```bash
git clone https://github.com/<you>/claude-analyzer.git && cd claude-analyzer
docker build -t claude-analyzer:latest .
```

Then create a **Web editor** stack with `docker-compose.yml` and delete the `build: .` line. The default `IMAGE` is `claude-analyzer:latest`.

---

## 2. Environment variables (Portainer "Environment variables" section)

In the stack editor, scroll to **Environment variables** → **Advanced mode** and paste, adjusting the values:

```env
PORT=3000
TZ=Europe/Paris
INGEST_TOKEN=paste-a-long-random-string-here
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=choose-a-password
ANTHROPIC_ADMIN_KEY=
SCAN_INTERVAL_SECONDS=300
```

Generate a token on any machine with Node or OpenSSL:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or
openssl rand -hex 32
```

| Variable | Required | Meaning |
|---|---|---|
| `PORT` | no (3000) | Host port the dashboard is published on |
| `TZ` | recommended | Timezone used for "per day" and "per hour" charts (e.g. `Europe/Paris`, `America/New_York`) |
| `INGEST_TOKEN` | for push mode | Shared secret the sync script must send. Empty = push disabled |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | recommended | HTTP basic auth for the whole UI and API. Empty password = no login |
| `ANTHROPIC_ADMIN_KEY` | no | Admin API key (`sk-ant-admin...`) for the **API organization** page; see section 6 |
| `SCAN_INTERVAL_SECONDS` | no (300) | How often a mounted folder is rescanned. `0` = only at startup and on the Refresh button |
| `IMAGE` | Option B only | Image to run |
| `PRICING_FILE` | no | Path inside the container to a custom pricing JSON; see section 7 |

Click **Deploy the stack**. In **Containers**, `claude-analyzer` should turn **healthy** within about 30 seconds. Open `http://<server-ip>:3000`. It is empty until data arrives (step 3).

---

## 3. Send your usage to the server

### Push mode: run the sync script on your PC

Requirements on the PC: **Node.js 18 or newer** (`node -v`) and a copy of this repository (only `scripts/` and `lib/` are needed, no `npm install`).

Test it once by hand:

```bash
node scripts/sync.mjs --url http://<server-ip>:3000 --token <INGEST_TOKEN>
# [10:42:27] 13/13 files changed, 3298 records sent to http://<server-ip>:3000
```

Run it again and it should send 0 records. It remembers file offsets in `~/.claude-analyzer-sync.json` and only reads new lines.
Useful flags: `--watch 300` (loop every 5 minutes), `--dir <path>` (custom Claude folder), `--reset` (resend everything).

To avoid putting the token in command lines, use environment variables instead:
`CLAUDE_ANALYZER_URL`, `CLAUDE_ANALYZER_TOKEN`.

Then make it automatic:

<details open>
<summary><b>Windows (Task Scheduler, hidden window)</b></summary>

**Quick way (uses the launcher shipped in this repo):**

1. Put the token alone in `%USERPROFILE%\.claude-analyzer-token`, for example with `notepad $env:USERPROFILE\.claude-analyzer-token`.
2. Edit the `urls` line in `scripts\sync-windows.vbs`. Several URLs are tried in order, so put the LAN address first and the public one second: `http://192.168.1.10:6969,https://claude.example.com`.
3. Register the task:
   ```powershell
   schtasks /Create /TN "Claude Analyzer Sync" /SC MINUTE /MO 10 /TR "wscript.exe \"C:\path\to\claude-analyzer\scripts\sync-windows.vbs\"" /F
   ```
   Output goes to `%USERPROFILE%\.claude-analyzer-sync.log`.
4. **On a laptop**, allow the task to run on battery. Windows' default holds it "queued" until you plug in:
   ```powershell
   Set-ScheduledTask -TaskName "Claude Analyzer Sync" -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5))
   ```

**Cloudflare Tunnel note:** syncing through the tunnel works with no extra setup. If you protect the hostname with **Cloudflare Access**, either add a bypass policy for the path `/api/ingest` or use the LAN URL only. Otherwise Access answers the script with a login page.

**Manual way:**

1. Create `C:\Users\<you>\claude-analyzer-sync.vbs`. It runs the sync with no console window popping up:

   ```vbs
   Set sh = CreateObject("WScript.Shell")
   sh.Environment("Process")("CLAUDE_ANALYZER_URL") = "http://<server-ip>:3000"
   sh.Environment("Process")("CLAUDE_ANALYZER_TOKEN") = "<INGEST_TOKEN>"
   sh.Run "node ""C:\Users\<you>\Documents\claude-analyzer\scripts\sync.mjs""", 0, True
   ```

2. Register a task that runs every 10 minutes (PowerShell or cmd):

   ```powershell
   schtasks /Create /TN "Claude Analyzer Sync" /SC MINUTE /MO 10 /TR "wscript.exe \"C:\Users\<you>\claude-analyzer-sync.vbs\"" /F
   ```

3. Test it: `schtasks /Run /TN "Claude Analyzer Sync"`, then watch **Data & sync** in the dashboard ("Last push ...").
   Remove it with `schtasks /Delete /TN "Claude Analyzer Sync" /F`.

</details>

<details>
<summary><b>macOS (launchd)</b></summary>

Create `~/Library/LaunchAgents/com.claude-analyzer.sync.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.claude-analyzer.sync</string>
  <key>ProgramArguments</key><array>
    <string>/usr/local/bin/node</string>
    <string>/Users/you/claude-analyzer/scripts/sync.mjs</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>CLAUDE_ANALYZER_URL</key><string>http://server-ip:3000</string>
    <key>CLAUDE_ANALYZER_TOKEN</key><string>INGEST_TOKEN</string>
  </dict>
  <key>StartInterval</key><integer>600</integer>
  <key>RunAtLoad</key><true/>
</dict></plist>
```

Load it with `launchctl load ~/Library/LaunchAgents/com.claude-analyzer.sync.plist`. Use `which node` for the node path.
</details>

<details>
<summary><b>Linux (cron)</b></summary>

`crontab -e`, then add:

```cron
*/10 * * * * CLAUDE_ANALYZER_URL=http://server-ip:3000 CLAUDE_ANALYZER_TOKEN=xxxx /usr/bin/node /home/you/claude-analyzer/scripts/sync.mjs >> /tmp/claude-sync.log 2>&1
```
</details>

### Folder mode: Claude Code runs on the Docker host

Edit the stack and uncomment the bind mount, using the real path of the user who runs Claude Code:

```yaml
    volumes:
      - claude-analyzer-data:/data
      - /home/youruser/.claude/projects:/claude/projects:ro
```

The container runs as user `node` (uid 1000). If the files aren't readable by that uid, the scan finds nothing. Check with `ls -ln ~/.claude/projects`.
The server scans at startup, every `SCAN_INTERVAL_SECONDS`, and when you click **Refresh**.

---

## 4. HTTPS and exposure (read this before opening a port to the internet)

Basic auth sends the password with every request, so use HTTPS for anything beyond your LAN.

- **Nginx Proxy Manager** (common with Portainer): add a Proxy Host `claude.example.com` → forward to `claude-analyzer:3000` (or `<server-ip>:3000`), and request a Let's Encrypt certificate under **SSL**.
  If NPM is on a different Docker network, put both containers on a shared network, or forward to the host IP.
- **Traefik**: add labels to the service, for example:
  ```yaml
      labels:
        - traefik.enable=true
        - traefik.http.routers.claude.rule=Host(`claude.example.com`)
        - traefik.http.routers.claude.entrypoints=websecure
        - traefik.http.routers.claude.tls.certresolver=letsencrypt
        - traefik.http.services.claude.loadbalancer.server.port=3000
  ```
  You can then remove the `ports:` section.
- **Tailscale / WireGuard only**: simplest if the dashboard never needs to be public. Point the sync script at the tailnet IP.

After switching to HTTPS, update `CLAUDE_ANALYZER_URL` in the sync task to `https://claude.example.com`.

---

## 5. Updating, backups, reset

- **Update**: Option A → *Pull and redeploy*. Option B/C → rebuild and push the image, then in Portainer *Recreate* the container with *Re-pull image* on. Data lives in the `claude-analyzer-data` volume and survives updates.
- **Backup**: the whole state is one SQLite file, `/data/claude-analyzer.db`, in the volume. Copy it with
  `docker cp claude-analyzer:/data/claude-analyzer.db ./backup.db` (stop the container first for a perfectly consistent copy).
  Nothing is lost for good anyway: your PC still has the raw logs, and `sync.mjs --reset` rebuilds everything.
- **Reset**: stop the stack, delete the `claude-analyzer-data` volume (Portainer → Volumes), start it again, then run `sync.mjs --reset` on each PC.

Note: Claude Code deletes session logs older than 30 days by default (`cleanupPeriodDays` in `~/.claude/settings.json`). The dashboard keeps everything it has ingested, so keep the sync running. To keep the raw logs longer, raise that setting, for example `"cleanupPeriodDays": 365`.

---

## 6. Optional: real API billing (API organization page)

If you also use the Claude API with a **Claude Console organization**, the dashboard can show that org's real usage and cost (all API keys, not only Claude Code) from Anthropic's Usage & Cost Analytics API.

1. Claude Console → **Settings → Admin keys** → create a key (`sk-ant-admin...`). Only organization admins can do this. Pro/Max subscriptions and individual accounts don't have an organization or admin keys.
2. Set `ANTHROPIC_ADMIN_KEY` in the stack and redeploy.

Data reaches that API within about 4 hours and starts on 2026-01-01. The server caches responses for 10 minutes.

---

## 7. Optional: custom prices

Costs on the Claude Code pages are **estimates at API list prices**, computed from `pricing.json` (USD per million tokens, cache multipliers, fast-mode multiplier). To change them:

1. Copy `pricing.json`, edit it, and put it on the server, e.g. `/opt/claude-analyzer/pricing.json`.
2. Mount it and point to it:
   ```yaml
       volumes:
         - /opt/claude-analyzer/pricing.json:/config/pricing.json:ro
       environment:
         PRICING_FILE: /config/pricing.json
   ```
3. Redeploy. All history is re-priced at startup.

Unknown model ids fall back to their family (`opus`, `sonnet`, `haiku`, `fable`).

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Container restarts / unhealthy | Portainer → container → **Logs**. `[db] using /data/claude-analyzer.db` and `Listening on` should appear |
| Sync prints `HTTP 401 Bad ingest token` | The token in the sync task differs from the stack's `INGEST_TOKEN` (watch for spaces or quotes) |
| Sync prints `HTTP 503 INGEST_TOKEN is not configured` | Set `INGEST_TOKEN` in the stack and redeploy |
| Sync prints `fetch failed` | Wrong URL or port, firewall, or `http` vs `https`. Try `curl http://<server>:3000/api/health` from the PC |
| Browser keeps asking for a password | Wrong `DASHBOARD_USER` / `DASHBOARD_PASSWORD`; the user defaults to `admin` |
| Dashboard empty after a push | Check the date range (try **All**) and the **Data & sync** page |
| Days look shifted | Set `TZ` to your timezone and redeploy |
| Folder mode finds 0 files | The mount path is wrong or unreadable by uid 1000; the container log says `not mounted` when the folder is missing |
| "API organization" shows an error | The key isn't an admin key, or the org can't use the analytics API |

Endpoints for quick checks: `GET /api/health` (no auth), `GET /api/meta` (sources, last scan/push, row counts).
