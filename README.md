# 9Router 🚀

**Local AI routing gateway & token saver with an OpenAI-compatible endpoint (`/v1/*`).**  
Never stop coding — save 20–40% input tokens with RTK, slash output tokens with Caveman/Ponytail, and route across 40+ providers with automatic 3-tier fallback (Subscription → Cheap → Free).

[⚡ Quick Start](#-quick-start) • [💡 Key Features](#-key-features) • [🔧 Client Setup](#-cli-tool-configuration) • [🌐 Providers](#-supported-providers) • [⚙️ Configuration](#️-configuration--environment-variables) • [📝 API](#-api-reference)

---

## 🔄 Architecture & Request Flow

```text
┌─────────────┐
│  Your CLI   │  (Claude Code, Cursor, Codex, OpenClaw, Cline, RooCode...)
│    Tool     │
└──────┬──────┘
       │ http://localhost:20128/v1
       ▼
┌──────────────────────────────────────────────────────────┐
│                  9Router Gateway                         │
│  • RTK Token Saver (in-place tool_result compression)    │
│  • Universal Translation (OpenAI ↔ Claude ↔ Gemini...)   │
│  • Quota Tracking & Auto Token Refresh (OAuth PKCE)      │
│  • Multi-Account Load Balancing                          │
└──────┬───────────────────────────────────────────────────┘
       │
       ├─→ [Tier 1: SUBSCRIPTION] Claude Code, Codex, GitHub Copilot
       │   ↓ quota exhausted / rate limit
       ├─→ [Tier 2: CHEAP / PAYG] GLM ($0.6/1M), MiniMax ($0.2/1M), DeepSeek
       │   ↓ budget limit / error
       └─→ [Tier 3: FREE / SELF-HOSTED] Kiro AI, OpenCode Free, Local Models
```

---

## ⚡ Quick Start

### Install CLI Globally from Source

```bash
npm install                     # root dependencies
cd cli && npm install && cd ..  # CLI dependencies (esbuild, etc.)
npm --prefix cli run build      # bundle Next.js standalone app into CLI
npm install -g ./cli            # install 9router CLI globally from source
9router
```

- **Dashboard:** `http://localhost:20128/dashboard`
- **OpenAI-Compatible Endpoint:** `http://localhost:20128/v1`

### Run from Source (Dev & Prod)

```bash
cp .env.example .env
npm install

# Dev mode
PORT=20128 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run dev

# Production build
npm run build
PORT=20128 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run start
```

### Run with Docker (Build Local Image)

Build and run the container locally from the repo `Dockerfile`:

```bash
# Build image
docker build -t 9router .

# Run container with persistent data
docker run -d \
  --name 9router \
  -p 20128:20128 \
  -v "$HOME/.9router:/app/data" \
  -e DATA_DIR=/app/data \
  9router
```

Or with Docker Compose:

```bash
docker compose up -d --build
```

---

## 💡 Key Features

| Feature | What It Does | Why It Matters |
| --- | --- | --- |
| 🚀 **RTK Token Saver** | Auto-detects and compresses verbose tool outputs (`git diff`, `grep`, `find`, `ls`, `tree`, log dumps) | **Saves 20–40% input tokens** per request |
| 🧠 **Headroom Token Saver** | Optional external `/v1/compress` proxy pipeline | Extra prompt compression without changing clients |
| 🪨 **Caveman Mode** | Injects terse, concise system prompt ("why use many token when few token do trick") | **Cuts up to 65% output tokens** while keeping full technical accuracy |
| 🐴 **Ponytail** | Injects "lazy senior dev" prompt (Lite / Full / Ultra) | Enforces YAGNI ladder: stdlib → native → existing deps → one-liner |
| 🎯 **Smart 3-Tier Fallback** | Auto-route: Subscription → Cheap → Free | **Zero downtime** during coding sprints |
| 🔄 **Format Translation** | Pivots through OpenAI intermediate format | Works seamlessly with any CLI tool or editor |
| 👥 **Multi-Account Support** | Round-robin or priority routing per provider | Load balance across accounts and avoid per-user rate limits |
| 🔄 **Auto Token Refresh** | Background refresh for OAuth credentials (PKCE) | Zero manual re-login interruptions |
| 📊 **Quota & Usage Tracking** | Live token accounting and reset countdowns | Maximize subscription quotas before they expire |

> **Bypass Header:** Pass `X-9Router-Token-Saver: off` on any chat completion request to bypass all compression filters.

---

## 🔧 CLI Tool Configuration

### Cursor IDE
- **OpenAI API Base URL:** `http://localhost:20128/v1`
- **OpenAI API Key:** Any value or dashboard API key (`REQUIRE_API_KEY=false` by default)
- **Model:** Target provider model (e.g. `cc/claude-opus-4-7`) or combo name

### Claude Code
In `~/.claude/config.json`:
```json
{
  "anthropic_api_base": "http://localhost:20128/v1",
  "anthropic_api_key": "your-9router-api-key"
}
```

### OpenAI Codex CLI
```bash
export OPENAI_BASE_URL="http://localhost:20128"
export OPENAI_API_KEY="your-9router-api-key"
codex "prompt"
```

### OpenClaw
In `~/.openclaw/openclaw.json`:
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "9router/kr/claude-sonnet-4.5"
      }
    }
  },
  "models": {
    "providers": {
      "9router": {
        "baseUrl": "http://127.0.0.1:20128/v1",
        "apiKey": "sk_9router",
        "api": "openai-completions",
        "models": [
          {
            "id": "kr/claude-sonnet-4.5",
            "name": "Claude Sonnet 4.5"
          }
        ]
      }
    }
  }
}
```

### Generic OpenAI-Compatible Tools (Cline, RooCode, Continue)
- **Base URL:** `http://localhost:20128/v1`
- **API Key:** Key from dashboard (or placeholder)
- **Model:** Any supported model ID or custom combo name

---

## 🌐 Supported Providers

### 🔐 OAuth Providers
Claude Code (`cc/*`), OpenAI Codex (`cx/*`), GitHub Copilot (`gh/*`), Cursor (`cu/*`), Antigravity, Kimchi.

### 🔑 API Key Providers (40+)
OpenAI, Anthropic, Gemini, DeepSeek, GLM, MiniMax, Kimi, Groq, xAI, Mistral, Together AI, Fireworks, Cerebras, Cohere, NVIDIA, SiliconFlow, Perplexity, OpenRouter, and more.

### 🆓 Free / Trial Tiers
- **Kiro AI (`kr/*`):** Claude 4.5, GLM-5, MiniMax (free tier subject to monthly credit caps).
- **OpenCode Free (`oc/*`):** No-auth passthrough proxy auto-fetched from `opencode.ai/zen/v1/models`.
- **Vertex AI (`vertex/*`, `vertex-partner/*`):** GCP service account integration ($300 credit support via Vertex AI Studio).

### 🏠 Self-Hosted Endpoints
Set `baseUrl` in connection settings (`providerSpecificData.baseUrl`):
- **Self-hosted STT (`/v1/audio/transcriptions`):** Pass full URL (e.g. `http://host:8080/v1/audio/transcriptions`).
- **Self-hosted TTS (`/v1/audio/speech`):** Pass server root (e.g. `http://host:8880`).
- **Self-hosted Embedding (`/v1/embeddings`):** Pass OpenAI base with `/v1` included (e.g. `http://host:8080/v1`).

---

## ⚙️ Configuration & Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `20128` | Gateway listening port |
| `HOSTNAME` | `0.0.0.0` / `localhost` | HTTP binding interface |
| `DATA_DIR` | `~/.9router` | Path for SQLite storage and runtime state |
| `INITIAL_PASSWORD` | `123456` | Default dashboard password on initial launch |
| `JWT_SECRET` | Auto-generated (`~/.9router/jwt-secret`) | Dashboard session cookie signing secret |
| `API_KEY_SECRET` | `endpoint-proxy-api-key-secret` | HMAC secret for generated API keys |
| `MACHINE_ID_SALT` | `endpoint-proxy-salt` | Salt for stable machine ID hashing |
| `REQUIRE_API_KEY` | `false` | Enforce Bearer token check on `/v1/*` routes |
| `AUTH_COOKIE_SECURE` | `false` | Enable Secure flag on cookies (for HTTPS proxies) |
| `BASE_URL` | `http://localhost:20128` | Internal server callback URL |
| `CLOUD_URL` | `https://9router.com` | Cloud sync service endpoint |
| `ENABLE_REQUEST_LOGS` | `false` | Log full payloads under `logs/` |
| `HTTP_PROXY` / `HTTPS_PROXY` | Empty | Outbound proxy for upstream provider requests |
| `SEARXNG_URL` | `http://localhost:8888/search` | Endpoint for built-in SearXNG search provider |

### 💾 Storage Layout

Data directory resolves to `DATA_DIR` (or `~/.9router/` if unset):
- **SQLite DB:** `${DATA_DIR}/db/data.sqlite` (accounts, combos, aliases, keys, settings)
- **Backups:** `${DATA_DIR}/db/backups/`
- **Usage & Logs:** `${DATA_DIR}/usage.json`, `${DATA_DIR}/log.txt`

---

## 📝 API Reference

### Chat Completions

```bash
POST http://localhost:20128/v1/chat/completions
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "model": "cc/claude-opus-4-7",
  "messages": [
    { "role": "user", "content": "Write an idiomatic LRU cache in Go." }
  ],
  "stream": true
}
```

### List Models

```bash
GET http://localhost:20128/v1/models
Authorization: Bearer <api-key>
```

Returns all active upstream models, aliases, and custom combos in standard OpenAI format.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
