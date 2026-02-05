# Decant Configuration Guide

Comprehensive guide to configuring Decant (TriliumNext with AI-powered features).

## Table of Contents

- [Configuration Methods](#configuration-methods)
- [Configuration Priority](#configuration-priority)
- [Server Configuration](#server-configuration)
- [AI Provider Settings](#ai-provider-settings)
- [Network & Security](#network--security)
- [Performance & Limits](#performance--limits)
- [Logging & Debugging](#logging--debugging)
- [Advanced Settings](#advanced-settings)

## Configuration Methods

Decant can be configured through three methods:

### 1. Environment Variables

Best for Docker deployments and infrastructure-as-code.

```bash
# Set environment variables
export TRILIUM_DATA_DIR=/opt/trilium-data
export TRILIUM_PORT=8080
export TRILIUM_HOST=0.0.0.0

# Start server
node dist/main.cjs
```

Or with `.env` file:
```bash
# .env
TRILIUM_DATA_DIR=/opt/trilium-data
TRILIUM_PORT=8080
```

### 2. config.ini File

Best for traditional server deployments.

Location: `{DATA_DIR}/config.ini`

```ini
[General]
instanceName=MyTrilium
noAuthentication=false

[Network]
host=0.0.0.0
port=8080
https=false
```

### 3. Runtime Settings (Options)

Best for user preferences and AI configuration.

- **Via UI**: Settings icon in application
- **Via API**: `POST /api/options/{name}`
- **Direct DB**: Not recommended

**Important:** Most AI settings are stored as "options" in the database, not in config.ini or environment variables.

## Configuration Priority

When the same setting exists in multiple places:

```
┌─────────────────────────────────┐
│  1. Environment Variables       │  <- HIGHEST PRIORITY
│     (Always win)                │
├─────────────────────────────────┤
│  2. config.ini File             │
│     (User configuration)        │
├─────────────────────────────────┤
│  3. Runtime Options             │
│     (Database-stored)           │
├─────────────────────────────────┤
│  4. Default Values              │  <- LOWEST PRIORITY
│     (Hardcoded)                 │
└─────────────────────────────────┘
```

**Example:**
```bash
# If you set both:
export TRILIUM_PORT=9000           # Environment variable
# AND in config.ini:
[Network]
port=8080

# Result: Server runs on port 9000 (environment wins)
```

## Server Configuration

### Core Settings

#### Data Directory

**Description:** Where all Trilium data is stored (database, backups, logs).

**Default:** `~/trilium-data`

**Environment Variable:**
```bash
TRILIUM_DATA_DIR=/opt/trilium-data
```

**config.ini:** Not configurable in INI (environment only)

**Subdirectories:**
- `document.db` - Main SQLite database
- `backup/` - Automatic backups
- `log/` - Application logs
- `tmp/` - Temporary files
- `config.ini` - Configuration file

#### Instance Name

**Description:** Identifies this Trilium instance (useful for multi-instance setups).

**Default:** Empty

**config.ini:**
```ini
[General]
instanceName=Production Server
```

**Environment Variable:**
```bash
TRILIUM_GENERAL_INSTANCENAME="Production Server"
```

**Access in Code:**
```javascript
// Backend script
const name = api.getInstanceName();
```

#### Read-Only Mode

**Description:** Prevents all data modifications (useful for backup/maintenance).

**Default:** `false`

**config.ini:**
```ini
[General]
readOnly=true
```

**Environment Variable:**
```bash
TRILIUM_GENERAL_READONLY=true
```

**Use Cases:**
- Running a backup server
- Demo/presentation mode
- Debugging without data changes

### Network Settings

#### Port

**Description:** HTTP/HTTPS port to listen on.

**Default:**
- Server: `3000`
- Desktop: `37840` (production) or `37740` (dev)

**config.ini:**
```ini
[Network]
port=8080
```

**Environment Variable:**
```bash
TRILIUM_PORT=8080              # Preferred
# OR
TRILIUM_NETWORK_PORT=8080      # Alternative
```

**Valid Range:** 0-65535
- Port 0 = Unix socket (uses `host` as socket path)
- Ports 1-1023 = Require root (not recommended)
- Ports 1024-65535 = Safe for non-root

#### Host/Bind Address

**Description:** Network interface to bind to.

**Default:** `0.0.0.0` (all interfaces)

**config.ini:**
```ini
[Network]
host=0.0.0.0
```

**Environment Variable:**
```bash
TRILIUM_HOST=0.0.0.0           # Preferred
# OR
TRILIUM_NETWORK_HOST=0.0.0.0   # Alternative
```

**Common Values:**
- `0.0.0.0` - Listen on all interfaces (public access)
- `127.0.0.1` - Listen on localhost only (local access)
- `192.168.1.100` - Listen on specific IP
- `/var/run/trilium.sock` - Unix socket (requires `port=0`)

**Security Recommendation:**
```ini
# If using reverse proxy:
host=127.0.0.1                  # Only accept local connections
trustedReverseProxy=true        # Trust proxy headers
```

#### HTTPS/SSL

**Description:** Enable native HTTPS support (not recommended for production - use reverse proxy instead).

**Default:** `false`

**config.ini:**
```ini
[Network]
https=true
certPath=/path/to/certificate.pem
keyPath=/path/to/private-key.pem
```

**Environment Variable:**
```bash
TRILIUM_NETWORK_HTTPS=true
TRILIUM_NETWORK_CERTPATH=/path/to/cert.pem
TRILIUM_NETWORK_KEYPATH=/path/to/key.pem
```

**Generating Self-Signed Certificate:**
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

**Production Recommendation:** Use a reverse proxy (Nginx/Caddy) instead of native HTTPS.

#### Trusted Reverse Proxy

**Description:** Trust X-Forwarded-* headers from reverse proxy.

**Default:** `false`

**config.ini:**
```ini
[Network]
trustedReverseProxy=true               # Trust all proxies

# OR specific IP/subnet:
trustedReverseProxy=192.168.1.100      # Single IP
trustedReverseProxy=192.168.1.0/24     # CIDR subnet
trustedReverseProxy=10.0.0.0/8,172.16.0.0/12  # Multiple subnets

# OR number of hops:
trustedReverseProxy=1                  # Trust 1 hop

# OR built-in shortcuts:
trustedReverseProxy=loopback           # 127.0.0.1/8, ::1/128
trustedReverseProxy=linklocal          # 169.254.0.0/16, fe80::/10
trustedReverseProxy=uniquelocal        # 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
```

**Environment Variable:**
```bash
TRILIUM_NETWORK_TRUSTEDREVERSEPROXY=true
```

**Why This Matters:**
When enabled, Trilium uses proxy-provided headers to determine:
- Client's real IP address
- Original protocol (HTTP vs HTTPS)
- Original hostname

**Important:** Only enable if you trust your reverse proxy!

### Authentication

#### Disable Authentication

**Description:** Allow access without login (useful for private networks).

**Default:** `false`

**config.ini:**
```ini
[General]
noAuthentication=true
```

**Environment Variable:**
```bash
TRILIUM_GENERAL_NOAUTHENTICATION=true
```

**Security Warning:** Only use on trusted networks! Anyone can access all data.

**Safe Use Cases:**
- Desktop application (already protected by OS)
- VPN-only access
- Internal network with firewall protection

#### Session Cookie Max Age

**Description:** How long "Remember Me" sessions stay valid.

**Default:** `1814400` seconds (21 days)

**config.ini:**
```ini
[Session]
cookieMaxAge=2592000  # 30 days in seconds
```

**Common Values:**
- `86400` - 1 day
- `604800` - 1 week
- `1814400` - 21 days (default)
- `2592000` - 30 days
- `7776000` - 90 days

#### Multi-Factor Authentication (OAuth/OpenID)

**Description:** Configure OpenID Connect for SSO.

**config.ini:**
```ini
[MultiFactorAuthentication]
oauthBaseUrl=https://auth.example.com
oauthClientId=trilium-client-id
oauthClientSecret=your-secret-here
oauthIssuerBaseUrl=https://auth.example.com
oauthIssuerName=My SSO Provider
oauthIssuerIcon=https://example.com/icon.png
```

**Supported Providers:**
- Keycloak
- Auth0
- Okta
- Google Workspace
- Azure AD
- Generic OpenID Connect

### Backup

#### Disable Automatic Backups

**Description:** Stop automatic database backups (not recommended).

**Default:** `false` (backups enabled)

**config.ini:**
```ini
[General]
noBackup=true
```

**Environment Variable:**
```bash
TRILIUM_GENERAL_NOBACKUP=true
```

**When to Disable:**
- Limited disk space
- Using external backup solution
- Running read-only instance

**Backup Location:** `{DATA_DIR}/backup/`

**Backup Schedule:**
- Automatic backups run weekly
- Last 4 weeks retained
- Manual backups via Settings > Backup

## AI Provider Settings

AI settings are stored as **options** in the database, not in config.ini or environment variables.

### Configuration Methods

**1. Via Settings UI:**
- Navigate to Settings (gear icon)
- Select "AI" section
- Configure provider, API key, model

**2. Via API:**
```bash
# Set OpenAI API key
curl -X PUT http://localhost:8080/api/options/openaiApiKey \
  -H "Content-Type: application/json" \
  -d '"sk-your-api-key-here"'

# Set selected provider
curl -X PUT http://localhost:8080/api/options/aiSelectedProvider \
  -H "Content-Type: application/json" \
  -d '"openai"'
```

**3. Via Backend Script:**
```javascript
// In a backend script
api.setOption('openaiApiKey', 'sk-your-key');
api.setOption('aiSelectedProvider', 'openai');
```

### Provider: OpenAI

#### Enable OpenAI

**Option Name:** `aiSelectedProvider`
**Value:** `openai`
**Default:** `openai`
**Synced:** Yes

**Set via UI:** Settings > AI > Provider > OpenAI

#### API Key

**Option Name:** `openaiApiKey`
**Value:** Your OpenAI API key
**Default:** Empty
**Synced:** No (local only - not synced for security)

**Get API Key:** https://platform.openai.com/api-keys

**Set via API:**
```bash
curl -X PUT http://localhost:8080/api/options/openaiApiKey \
  -H "Content-Type: application/json" \
  -d '"sk-proj-abcd1234..."'
```

#### Base URL

**Option Name:** `openaiBaseUrl`
**Value:** API endpoint URL
**Default:** `https://api.openai.com/v1`
**Synced:** Yes

**When to Change:**
- Using Azure OpenAI: `https://{resource}.openai.azure.com/openai/deployments/{deployment-id}`
- Using OpenAI-compatible service (e.g., LocalAI)

**Example (Azure):**
```bash
curl -X PUT http://localhost:8080/api/options/openaiBaseUrl \
  -H "Content-Type: application/json" \
  -d '"https://myresource.openai.azure.com/openai/deployments/gpt-4"'
```

#### Default Model

**Option Name:** `openaiDefaultModel`
**Value:** Model identifier
**Default:** Empty (uses GPT-4 if available)
**Synced:** Yes

**Common Models:**
- `gpt-4` - Most capable
- `gpt-4-turbo` - Faster GPT-4
- `gpt-4o` - Optimized GPT-4
- `gpt-3.5-turbo` - Faster, cheaper

**Set via API:**
```bash
curl -X PUT http://localhost:8080/api/options/openaiDefaultModel \
  -H "Content-Type: application/json" \
  -d '"gpt-4o"'
```

**Override per Request:**
```javascript
// In tool call, specify model:
await api.aiCompletion({
  messages: [...],
  model: 'openai:gpt-4-turbo'  // Format: provider:model
});
```

### Provider: Anthropic (Claude)

#### Enable Anthropic

**Option Name:** `aiSelectedProvider`
**Value:** `anthropic`
**Synced:** Yes

#### API Key

**Option Name:** `anthropicApiKey`
**Value:** Your Anthropic API key
**Default:** Empty
**Synced:** No

**Get API Key:** https://console.anthropic.com/settings/keys

#### Base URL

**Option Name:** `anthropicBaseUrl`
**Value:** API endpoint URL
**Default:** `https://api.anthropic.com/v1`
**Synced:** Yes

#### Default Model

**Option Name:** `anthropicDefaultModel`
**Value:** Model identifier
**Default:** Empty (uses latest Claude)
**Synced:** Yes

**Available Models:**
- `claude-3-5-sonnet-20241022` - Latest Sonnet (recommended)
- `claude-3-5-haiku-20241022` - Fast, cost-effective
- `claude-3-opus-20240229` - Most capable
- `claude-3-sonnet-20240229` - Balanced
- `claude-3-haiku-20240307` - Fast

**Example:**
```bash
curl -X PUT http://localhost:8080/api/options/anthropicDefaultModel \
  -H "Content-Type: application/json" \
  -d '"claude-3-5-sonnet-20241022"'
```

### Provider: Ollama (Local)

#### Enable Ollama

**Option Name:** `ollamaEnabled`
**Value:** `true` or `false`
**Default:** `false`
**Synced:** Yes

**Also Set:**
```bash
# Enable Ollama
curl -X PUT http://localhost:8080/api/options/ollamaEnabled \
  -H "Content-Type: application/json" \
  -d 'true'

# Set as selected provider
curl -X PUT http://localhost:8080/api/options/aiSelectedProvider \
  -H "Content-Type: application/json" \
  -d '"ollama"'
```

#### Base URL

**Option Name:** `ollamaBaseUrl`
**Value:** Ollama server URL
**Default:** `http://localhost:11434`
**Synced:** Yes

**Common Values:**
- `http://localhost:11434` - Local installation
- `http://ollama-server:11434` - Docker network
- `https://ollama.example.com` - Remote server

#### Default Model

**Option Name:** `ollamaDefaultModel`
**Value:** Model name (must be pulled in Ollama)
**Default:** Empty
**Synced:** Yes

**Popular Models:**
- `llama3:latest` - Meta's Llama 3
- `mistral:latest` - Mistral AI
- `codellama:latest` - Code-focused
- `phi3:latest` - Microsoft Phi-3
- `gemma2:latest` - Google Gemma 2

**Setup:**
```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull model
ollama pull llama3

# 3. Configure Trilium
curl -X PUT http://localhost:8080/api/options/ollamaDefaultModel \
  -H "Content-Type: application/json" \
  -d '"llama3:latest"'
```

### General AI Settings

#### AI Temperature

**Option Name:** `aiTemperature`
**Value:** Number 0.0 - 2.0
**Default:** `0.7`
**Synced:** Yes

**What It Controls:**
- `0.0` - Deterministic, focused (good for factual tasks)
- `0.7` - Balanced creativity (default)
- `1.0` - More creative
- `2.0` - Maximum creativity (can be incoherent)

**Example:**
```bash
curl -X PUT http://localhost:8080/api/options/aiTemperature \
  -H "Content-Type: application/json" \
  -d '"0.3"'  # More focused for categorization
```

#### System Prompt

**Option Name:** `aiSystemPrompt`
**Value:** Custom system prompt
**Default:** Empty (uses built-in prompt)
**Synced:** Yes

**Use Cases:**
- Customize AI behavior
- Add domain-specific context
- Enforce output format

**Example:**
```bash
curl -X PUT http://localhost:8080/api/options/aiSystemPrompt \
  -H "Content-Type: application/json" \
  -d '"You are a helpful assistant specialized in software development. Always prioritize code quality and best practices."'
```

**Note:** Custom prompt **replaces** the default system prompt. Include all necessary instructions.

### Embedding Provider (Voyage AI)

Used for semantic search (future feature).

#### API Key

**Option Name:** `voyageApiKey`
**Value:** Voyage AI API key
**Default:** Empty
**Synced:** No

**Get API Key:** https://www.voyageai.com/

## Network & Security

### CORS Configuration

**Description:** Configure Cross-Origin Resource Sharing for API access.

**config.ini:**
```ini
[Network]
corsAllowOrigin=*
corsAllowMethods=GET,POST,PUT,DELETE,PATCH
corsAllowHeaders=Content-Type,Authorization
```

**Environment Variables:**
```bash
TRILIUM_NETWORK_CORSALLOWORIGIN="*"
TRILIUM_NETWORK_CORSALLOWMETHODS="GET,POST,PUT,DELETE,PATCH"
TRILIUM_NETWORK_CORSALLOWHEADERS="Content-Type,Authorization"
```

**Security:**
- `corsAllowOrigin=*` - Allow all origins (development only!)
- `corsAllowOrigin=https://app.example.com` - Specific origin (production)
- `corsAllowOrigin=https://a.com,https://b.com` - Multiple origins

### Rate Limiting

Currently not configurable via settings. Implement via reverse proxy.

**Nginx Example:**
```nginx
# Limit general API requests
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

# Stricter limit for AI import
limit_req_zone $binary_remote_addr zone=ai_import:10m rate=10r/m;

location /api/ {
    limit_req zone=api burst=20;
    proxy_pass http://127.0.0.1:8080;
}

location /api/ai-import {
    limit_req zone=ai_import burst=5;
    proxy_pass http://127.0.0.1:8080;
}
```

## Performance & Limits

### File Upload Size

**Description:** Maximum size for file attachments and imports.

**Not directly configurable** in Trilium. Configure in reverse proxy:

**Nginx:**
```nginx
client_max_body_size 500M;
```

**Caddy:**
```
request_body {
    max_size 500MB
}
```

**Default:** 100MB (Express.js default)

### Database Vacuum

**Description:** Reclaim disk space and optimize database.

**Not automatic.** Run manually:

```bash
# Stop Trilium
sudo systemctl stop trilium

# Run VACUUM
sqlite3 /opt/trilium-data/document.db "VACUUM;"

# Restart Trilium
sudo systemctl start trilium
```

**When to Run:**
- After deleting many notes
- Database size much larger than actual data
- Performance degradation

**Caution:** Requires free space equal to database size during operation.

### Connection Timeouts

**config.ini:** Not configurable

**Hardcoded:** 600 seconds (10 minutes) keep-alive timeout

**Configure in Reverse Proxy:**

**Nginx:**
```nginx
proxy_connect_timeout 600;
proxy_send_timeout 600;
proxy_read_timeout 600;
send_timeout 600;
```

## Logging & Debugging

### Log Directory

**Environment Variable:**
```bash
TRILIUM_LOG_DIR=/var/log/trilium
```

**Default:** `{DATA_DIR}/log/`

**Log Files:**
- `trilium-YYYY-MM-DD.log` - Application logs
- Individual request logs (if enabled)

### Debug Logging

**Enable Debug Mode:**

```bash
# All debug output
DEBUG=* node dist/main.cjs

# Trilium-specific only
DEBUG=trilium:* node dist/main.cjs

# Specific modules
DEBUG=trilium:sql,trilium:sync node dist/main.cjs
```

**PM2:**
```javascript
// ecosystem.config.js
env: {
  DEBUG: 'trilium:*'
}
```

**systemd:**
```ini
[Service]
Environment="DEBUG=trilium:*"
```

### Access Logs

**View Application Logs:**

Via API:
```
GET /api/backend-log
```

Via file system:
```bash
tail -f /opt/trilium-data/log/trilium-$(date +%Y-%m-%d).log
```

**systemd:**
```bash
journalctl -u trilium -f
```

**PM2:**
```bash
pm2 logs trilium --lines 100
```

### Safe Mode

**Description:** Start with minimal features (useful for debugging).

**Environment Variable:**
```bash
TRILIUM_SAFE_MODE=true node dist/main.cjs
```

**What It Does:**
- Disables all frontend scripts
- Starts with root note
- Minimal UI loaded

## Advanced Settings

### Sync Configuration

**Description:** Connect to sync server for multi-device synchronization.

**config.ini:**
```ini
[Sync]
syncServerHost=https://sync.example.com
syncServerTimeout=120000
syncServerProxy=http://proxy.example.com:8080
```

**Environment Variables:**
```bash
TRILIUM_SYNC_SYNCSERVERHOST="https://sync.example.com"
# OR
TRILIUM_SYNC_SERVER_HOST="https://sync.example.com"  # Alternative

TRILIUM_SYNC_SYNCSERVERTIMEOUT=120000
TRILIUM_SYNC_SYNCSERVERPROXY="http://proxy:8080"
```

**Setup:**
1. Configure sync server URL
2. Get sync token from server
3. Enter token in Settings > Sync
4. Initial sync begins automatically

### Custom File Paths

Override individual file paths:

```bash
# Database file
TRILIUM_DOCUMENT_PATH=/data/db/document.db

# Backups
TRILIUM_BACKUP_DIR=/backups/trilium

# Logs
TRILIUM_LOG_DIR=/var/log/trilium

# Temporary files
TRILIUM_TMP_DIR=/tmp/trilium

# Config file
TRILIUM_CONFIG_INI_PATH=/etc/trilium/config.ini

# Anonymized DB (for bug reports)
TRILIUM_ANONYMIZED_DB_DIR=/tmp/trilium-anonymous
```

**Use Case:** Separate fast SSD for database, slower storage for backups.

### Desktop App Settings

**Disable Desktop Icon:**

**config.ini:**
```ini
[General]
noDesktopIcon=true
```

**Environment Variable:**
```bash
TRILIUM_GENERAL_NODESKTOPICON=true
```

**Note:** Desktop-specific. No effect on server deployment.

### Integration Test Mode

**Description:** Special mode for running tests.

**Environment Variable:**
```bash
TRILIUM_INTEGRATION_TEST=edit
```

**Do not use in production.**

## Configuration Examples

### Personal Desktop Setup

```bash
# .env or export
TRILIUM_DATA_DIR=~/Documents/trilium-data
TRILIUM_PORT=37840
NODE_ENV=production
```

### Small Team Server

```ini
# config.ini
[General]
instanceName=Team Knowledge Base
noAuthentication=false

[Network]
host=127.0.0.1         # Behind reverse proxy
port=8080
https=false
trustedReverseProxy=true

[Session]
cookieMaxAge=604800    # 1 week
```

```bash
# Environment variables
TRILIUM_DATA_DIR=/opt/trilium-data
```

### High-Security Setup

```ini
# config.ini
[General]
noAuthentication=false

[Network]
host=127.0.0.1                  # Reverse proxy only
port=8080
https=false
trustedReverseProxy=192.168.1.100   # Specific proxy IP
corsAllowOrigin=                # No CORS

[Session]
cookieMaxAge=86400              # 1 day sessions

[MultiFactorAuthentication]
oauthBaseUrl=https://auth.company.com
oauthClientId=trilium-prod
oauthClientSecret=***
```

### Docker Production

```yaml
# docker-compose.yml
services:
  trilium:
    image: triliumnext/trilium:latest
    restart: unless-stopped
    environment:
      - TRILIUM_DATA_DIR=/home/node/trilium-data
      - TRILIUM_PORT=8080
      - TRILIUM_HOST=0.0.0.0
    ports:
      - '127.0.0.1:8080:8080'  # Local only
    volumes:
      - trilium-data:/home/node/trilium-data
    mem_limit: 2g
    healthcheck:
      test: ["CMD", "node", "/usr/src/app/docker_healthcheck.cjs"]
      interval: 30s

volumes:
  trilium-data:
```

### Development Setup

```bash
# .env
TRILIUM_ENV=dev
TRILIUM_DATA_DIR=./data
TRILIUM_PORT=8080
TRILIUM_HOST=0.0.0.0
NODE_ENV=development
DEBUG=trilium:*
```

## Troubleshooting Configuration

### Configuration Not Applied

**Check Priority:**
1. Is environment variable set? (overrides all)
2. Is config.ini value correct?
3. Restart required for some settings

**Verify:**
```bash
# Check effective configuration
curl http://localhost:8080/api/app-info

# Check options (AI settings)
curl http://localhost:8080/api/options
```

### AI Configuration Issues

**Symptoms:**
- "AI service not available"
- "No provider configured"
- Import fails silently

**Debug:**
```bash
# Check AI configuration
curl http://localhost:8080/api/options | grep -E 'ai|openai|anthropic|ollama'

# Test AI service
curl -X POST http://localhost:8080/api/ai-import/status
```

**Common Issues:**
1. **No provider selected**: Set `aiSelectedProvider`
2. **No API key**: Set `openaiApiKey` or `anthropicApiKey`
3. **No model**: Set `openaiDefaultModel` or `anthropicDefaultModel`
4. **Invalid API key**: Check key format and validity

**Reset AI Configuration:**
```bash
# Via API
curl -X PUT http://localhost:8080/api/options/aiSelectedProvider -H "Content-Type: application/json" -d '"openai"'
curl -X PUT http://localhost:8080/api/options/openaiApiKey -H "Content-Type: application/json" -d '"sk-..."'
curl -X PUT http://localhost:8080/api/options/openaiDefaultModel -H "Content-Type: application/json" -d '"gpt-4o"'
```

### Port Conflicts

**Error:** "Port 8080 is already in use"

**Find Process:**
```bash
sudo lsof -i :8080
# OR
sudo netstat -tulpn | grep 8080
```

**Solutions:**
1. Change port: `TRILIUM_PORT=8081`
2. Stop conflicting process
3. Use different network interface

### Database Location Issues

**Error:** "Cannot open database"

**Check:**
```bash
# Verify path exists
ls -la $TRILIUM_DATA_DIR

# Check permissions
stat $TRILIUM_DATA_DIR/document.db

# Verify ownership
ls -l $TRILIUM_DATA_DIR/document.db
```

**Fix Permissions:**
```bash
sudo chown -R trilium:trilium /opt/trilium-data
chmod 700 /opt/trilium-data
chmod 600 /opt/trilium-data/document.db
```

## Configuration Validation

### Check Current Configuration

```bash
# Application info
curl http://localhost:8080/api/app-info | jq

# All options
curl http://localhost:8080/api/options | jq

# Specific option
curl http://localhost:8080/api/options/aiSelectedProvider
```

### Test AI Configuration

```bash
# Check status
curl http://localhost:8080/api/ai-import/status

# Test import (requires API authentication)
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/TriliumNext/Trilium"}'
```

### Verify Network Configuration

```bash
# Check if listening on expected port
netstat -tuln | grep 8080

# Test local access
curl -I http://localhost:8080

# Test external access (if applicable)
curl -I http://your-server-ip:8080
```

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [AI_IMPORT_SERVICE.md](./AI_IMPORT_SERVICE.md) - AI import details
- [TriliumNext Docs](https://triliumnotes.org/docs) - Official documentation

---

**Questions or Issues?**
- GitHub: https://github.com/TriliumNext/Trilium/issues
- Discord: https://discord.gg/triliumnext
