# Decant Deployment Guide

This guide covers deploying Decant (TriliumNext with AI-powered auto-categorization) to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Environment Variables](#environment-variables)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Scaling Considerations](#scaling-considerations)
- [Production Checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum:**
- 2 CPU cores
- 2GB RAM
- 5GB disk space (more for data)
- Linux, macOS, or Windows

**Recommended:**
- 4+ CPU cores
- 4GB+ RAM
- 20GB+ SSD storage
- Linux (Ubuntu 22.04+, Debian 12+, RHEL 9+)

### Software Requirements

**Node.js:**
- Version: 20.0.0 or later
- Verify: `node --version`
- Download: https://nodejs.org/

**pnpm:**
- Version: 10.28.0 or later
- Install: `corepack enable` (included with Node.js 16.13+)
- Verify: `pnpm --version`

**Docker (Optional):**
- Version: 24.0.0+ with Docker Compose
- Verify: `docker --version && docker compose version`

### AI Provider Requirements

To use AI auto-categorization, you need at least one:

- **OpenAI**: API key from https://platform.openai.com/
- **Anthropic**: API key from https://console.anthropic.com/
- **Ollama**: Self-hosted at http://localhost:11434 (no API key needed)

## Docker Deployment

Docker is the recommended deployment method for production.

### Quick Start with Docker Compose

1. **Create docker-compose.yml:**

```yaml
services:
  trilium:
    image: triliumnext/trilium:latest
    restart: unless-stopped
    environment:
      - TRILIUM_DATA_DIR=/home/node/trilium-data
      # Optional: Set port (default 8080)
      # - TRILIUM_PORT=8080
      # Optional: Set host binding (default 0.0.0.0)
      # - TRILIUM_HOST=0.0.0.0
    ports:
      - '8080:8080'
    volumes:
      # Persist data
      - ${TRILIUM_DATA_DIR:-~/trilium-data}:/home/node/trilium-data
      # Timezone support
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    healthcheck:
      test: ["CMD", "node", "/usr/src/app/docker_healthcheck.cjs"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

2. **Start the service:**

```bash
docker compose up -d
```

3. **Access Decant:**

Open http://localhost:8080 in your browser.

### Custom Data Directory

```bash
# Specify a custom data directory
TRILIUM_DATA_DIR=/path/to/data docker compose up -d
```

### Building Custom Docker Image

If you've made custom modifications:

```bash
# Clone repository
git clone https://github.com/TriliumNext/Trilium.git
cd Trilium

# Build application
pnpm install
pnpm run server:build

# Build Docker image
cd apps/server
pnpm docker-build-debian

# Run custom image
docker run -d \
  -p 8080:8080 \
  -v ~/trilium-data:/home/node/trilium-data \
  --restart unless-stopped \
  --name trilium \
  triliumnext-debian
```

### Docker Image Variants

- **`triliumnext-debian`**: Standard Debian-based (recommended)
- **`triliumnext-alpine`**: Smaller Alpine Linux-based
- **`triliumnext-rootless-debian`**: Rootless for enhanced security
- **`triliumnext-rootless-alpine`**: Rootless Alpine variant

Build commands:
```bash
pnpm docker-build-debian
pnpm docker-build-alpine
pnpm docker-build-rootless-debian
pnpm docker-build-rootless-alpine
```

## Manual Deployment

### From Source

**1. Clone and Install:**

```bash
# Clone repository
git clone https://github.com/TriliumNext/Trilium.git
cd Trilium

# Enable pnpm
corepack enable

# Install dependencies
pnpm install

# Build client and server
pnpm run client:build
pnpm run server:build
```

**2. Set Data Directory:**

```bash
# Create data directory
mkdir -p /opt/trilium-data

# Set environment variable
export TRILIUM_DATA_DIR=/opt/trilium-data
```

**3. Run Production Server:**

```bash
cd apps/server
NODE_ENV=production node dist/main.cjs
```

### Using PM2 Process Manager

PM2 keeps your application running and handles restarts.

**1. Install PM2:**

```bash
npm install -g pm2
```

**2. Create PM2 Ecosystem File:**

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'trilium',
    script: 'dist/main.cjs',
    cwd: '/path/to/Trilium/apps/server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      TRILIUM_DATA_DIR: '/opt/trilium-data',
      TRILIUM_PORT: '8080',
      TRILIUM_HOST: '0.0.0.0'
    },
    error_file: '/var/log/trilium/error.log',
    out_file: '/var/log/trilium/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

**3. Start with PM2:**

```bash
# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions printed by the command above

# Monitor
pm2 status
pm2 logs trilium
pm2 monit
```

**4. PM2 Management Commands:**

```bash
# Restart
pm2 restart trilium

# Stop
pm2 stop trilium

# Delete
pm2 delete trilium

# View logs
pm2 logs trilium --lines 100

# Monitor resource usage
pm2 monit
```

### Using systemd (Linux)

**1. Create systemd Service File:**

Create `/etc/systemd/system/trilium.service`:

```ini
[Unit]
Description=Trilium Notes Server
After=network.target

[Service]
Type=simple
User=trilium
Group=trilium
WorkingDirectory=/opt/trilium/apps/server
Environment="NODE_ENV=production"
Environment="TRILIUM_DATA_DIR=/opt/trilium-data"
Environment="TRILIUM_PORT=8080"
Environment="TRILIUM_HOST=0.0.0.0"
ExecStart=/usr/bin/node /opt/trilium/apps/server/dist/main.cjs
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=trilium

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/trilium-data

# Resource limits
LimitNOFILE=65536
MemoryMax=2G

[Install]
WantedBy=multi-user.target
```

**2. Create User and Set Permissions:**

```bash
# Create system user
sudo useradd -r -s /bin/false trilium

# Set ownership
sudo chown -R trilium:trilium /opt/trilium
sudo chown -R trilium:trilium /opt/trilium-data
```

**3. Enable and Start Service:**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable trilium

# Start service
sudo systemctl start trilium

# Check status
sudo systemctl status trilium

# View logs
sudo journalctl -u trilium -f
```

**4. systemd Management Commands:**

```bash
# Restart
sudo systemctl restart trilium

# Stop
sudo systemctl stop trilium

# Disable autostart
sudo systemctl disable trilium

# View recent logs
sudo journalctl -u trilium -n 100 --no-pager
```

## Environment Variables

### Complete Reference

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| **Core Settings** | | | |
| `TRILIUM_DATA_DIR` | Data directory path | `~/trilium-data` | `/opt/trilium-data` |
| `TRILIUM_PORT` | HTTP port | `3000` (server)<br>`37840` (desktop) | `8080` |
| `TRILIUM_HOST` | Bind address | `0.0.0.0` | `127.0.0.1` |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `TRILIUM_ENV` | Trilium environment | - | `production` |
| **File Paths** | | | |
| `TRILIUM_DOCUMENT_PATH` | Database file | `{DATA_DIR}/document.db` | `/data/db/document.db` |
| `TRILIUM_BACKUP_DIR` | Backup directory | `{DATA_DIR}/backup` | `/backups` |
| `TRILIUM_LOG_DIR` | Log directory | `{DATA_DIR}/log` | `/var/log/trilium` |
| `TRILIUM_TMP_DIR` | Temporary files | `{DATA_DIR}/tmp` | `/tmp/trilium` |
| `TRILIUM_CONFIG_INI_PATH` | Config file path | `{DATA_DIR}/config.ini` | `/etc/trilium/config.ini` |
| **Network (Alternative to config.ini)** | | | |
| `TRILIUM_NETWORK_HOST` | Bind address | - | `0.0.0.0` |
| `TRILIUM_NETWORK_PORT` | HTTP port | - | `8080` |
| **Sync** | | | |
| `TRILIUM_SYNC_SYNCSERVERHOST` | Sync server URL | - | `https://sync.example.com` |
| `TRILIUM_SYNC_SERVER_HOST` | Alias for above | - | `https://sync.example.com` |
| **AI Provider Configuration** | | | |
| See CONFIGURATION.md for AI-specific environment variables | | | |

### Priority Order

Environment variables **always override** config.ini settings:

1. **Environment Variables** (highest priority)
2. **config.ini File**
3. **Default Values** (lowest priority)

### Example .env File

Create a `.env` file for easy management:

```bash
# Core Settings
TRILIUM_DATA_DIR=/opt/trilium-data
TRILIUM_PORT=8080
TRILIUM_HOST=0.0.0.0
NODE_ENV=production

# Logging
TRILIUM_LOG_DIR=/var/log/trilium

# AI Configuration (stored in database, not environment)
# These are set via the UI or API after first startup
```

**Note:** AI provider settings (API keys, models) are stored in the database as "options", not environment variables. Configure them through:
- Settings UI (`/options`)
- API: `POST /api/options/{name}`
- Direct database modification (not recommended)

## SSL/TLS Configuration

### Option 1: Reverse Proxy (Recommended)

Use a reverse proxy like Nginx or Caddy to handle SSL termination.

#### Nginx Configuration

**1. Install Nginx:**

```bash
sudo apt-get install nginx certbot python3-certbot-nginx
```

**2. Create Nginx Config:**

Create `/etc/nginx/sites-available/trilium`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name trilium.example.com;

    # Let's Encrypt challenge
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name trilium.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/trilium.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trilium.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase max upload size for large attachments
    client_max_body_size 500M;

    # Proxy Configuration
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forward original client information
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # Timeouts for long operations
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

**3. Configure Trilium to Trust Reverse Proxy:**

Edit `config.ini`:

```ini
[Network]
# Bind to localhost only (Nginx will forward)
host=127.0.0.1
port=8080

# Trust Nginx proxy
trustedReverseProxy=true
```

Or use environment variable:
```bash
TRILIUM_NETWORK_HOST=127.0.0.1
```

**4. Enable and Get SSL Certificate:**

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/trilium /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d trilium.example.com

# Restart Nginx
sudo systemctl restart nginx

# Setup auto-renewal
sudo systemctl enable certbot.timer
```

#### Caddy Configuration (Simpler Alternative)

**1. Install Caddy:**

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

**2. Create Caddyfile:**

Create `/etc/caddy/Caddyfile`:

```
trilium.example.com {
    reverse_proxy localhost:8080

    # Caddy handles SSL automatically with Let's Encrypt
    encode gzip

    # Increase upload size
    request_body {
        max_size 500MB
    }
}
```

**3. Start Caddy:**

```bash
sudo systemctl restart caddy
sudo systemctl enable caddy
```

Caddy automatically obtains and renews SSL certificates!

### Option 2: Native HTTPS in Trilium

Trilium can serve HTTPS directly (not recommended for production).

**1. Generate Self-Signed Certificate:**

```bash
cd /opt/trilium-data

# Generate certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=trilium.example.com"
```

**2. Configure config.ini:**

```ini
[Network]
https=true
certPath=/opt/trilium-data/cert.pem
keyPath=/opt/trilium-data/key.pem
port=8443
```

**3. Restart Trilium:**

Access via https://localhost:8443

**Note:** Browsers will warn about self-signed certificates. For production, use a reverse proxy with proper certificates.

## Scaling Considerations

### Database Location

**SQLite Limitations:**

Decant uses SQLite, which is:
- **Single-writer**: Only one process can write at a time
- **File-based**: Must be on local filesystem (not NFS)
- **Good for**: Small to medium deployments (<10k notes, <10 concurrent users)

**Recommendations:**

- **Small deployments (<1k notes)**: Default SQLite is perfect
- **Medium deployments (1k-10k notes)**: Use SSD storage, regular backups
- **Large deployments (>10k notes)**: Consider migration to PostgreSQL (requires code changes)

**Database Location Best Practices:**

```bash
# Use SSD/NVMe storage
TRILIUM_DATA_DIR=/mnt/ssd/trilium-data

# NOT recommended (network filesystem)
# TRILIUM_DATA_DIR=/mnt/nfs/trilium-data  # Will cause corruption!
```

### Memory Usage

**Typical Memory Footprint:**

- **Base**: 200-400MB
- **Active use**: 400-800MB
- **Large notes**: +100-500MB
- **AI operations**: +200-500MB per concurrent request

**Memory Guidelines:**

| Deployment Size | RAM Recommendation |
|-----------------|-------------------|
| Personal (<1k notes) | 2GB |
| Small team (<5k notes) | 4GB |
| Medium org (<20k notes) | 8GB |
| Large deployment | 16GB+ |

**Set Memory Limits:**

PM2:
```javascript
max_memory_restart: '2G'  // Restart if exceeds 2GB
```

Docker:
```bash
docker run -m 2g --memory-swap 2g ...
```

systemd:
```ini
MemoryMax=2G
```

### AI Queue Processing

AI auto-categorization is asynchronous but resource-intensive:

**Concurrent Requests:**
- Default: Processed sequentially
- No built-in queue system yet (planned for future)

**Rate Limiting Recommendations:**

```nginx
# Nginx rate limiting for /api/ai-import
limit_req_zone $binary_remote_addr zone=ai_import:10m rate=10r/m;

location /api/ai-import {
    limit_req zone=ai_import burst=5;
    proxy_pass http://127.0.0.1:8080;
}
```

### Horizontal Scaling

**Current Limitations:**
- SQLite doesn't support multiple writers
- No built-in load balancing
- Session state is server-local

**Not Recommended:**
- Running multiple instances with shared SQLite database

**Future Considerations:**
- Migration to PostgreSQL for multi-instance support
- Redis for shared session state
- Separate AI service for horizontal scaling

### Performance Optimization

**1. Database Optimization:**

Regular maintenance:
```bash
# Run VACUUM to reclaim space (requires downtime)
sqlite3 /opt/trilium-data/document.db "VACUUM;"

# Analyze for query optimization
sqlite3 /opt/trilium-data/document.db "ANALYZE;"
```

**2. File System:**

- Use SSD/NVMe storage
- Enable filesystem caching
- Consider `noatime` mount option:
```bash
/dev/sda1 /opt/trilium-data ext4 defaults,noatime 0 2
```

**3. Nginx Caching:**

```nginx
# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Production Checklist

### Pre-Deployment

- [ ] Node.js 20.0.0+ installed
- [ ] pnpm 10.28.0+ installed (or Docker configured)
- [ ] Data directory created with correct permissions
- [ ] SSL certificates obtained (if using HTTPS)
- [ ] Firewall rules configured
- [ ] Backup strategy planned
- [ ] Monitoring tools setup

### Security

- [ ] Change default admin password on first login
- [ ] Enable HTTPS (via reverse proxy or native)
- [ ] Configure `trustedReverseProxy` if using proxy
- [ ] Set restrictive file permissions:
  ```bash
  chmod 700 /opt/trilium-data
  chown trilium:trilium /opt/trilium-data
  ```
- [ ] Configure firewall:
  ```bash
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp    # HTTP
  sudo ufw allow 443/tcp   # HTTPS
  sudo ufw enable
  ```
- [ ] Review security headers in reverse proxy
- [ ] Enable rate limiting for API endpoints
- [ ] Consider disabling authentication only for trusted networks

### Post-Deployment Verification

**1. Application Health:**

```bash
# Check if service is running
systemctl status trilium    # systemd
pm2 status                   # PM2
docker ps                    # Docker

# Check logs for errors
journalctl -u trilium -n 50  # systemd
pm2 logs trilium             # PM2
docker logs trilium          # Docker
```

**2. Network Connectivity:**

```bash
# Test local access
curl -I http://localhost:8080

# Test external access
curl -I https://trilium.example.com

# Test WebSocket (for sync)
wscat -c wss://trilium.example.com/api/sync
```

**3. Database Health:**

```bash
# Check database file
sqlite3 /opt/trilium-data/document.db "PRAGMA integrity_check;"

# Verify size is reasonable
du -h /opt/trilium-data/document.db
```

**4. AI Service (if configured):**

Access Settings > AI and verify:
- [ ] Provider is selected (OpenAI/Anthropic/Ollama)
- [ ] API key is configured (if required)
- [ ] Model is selected
- [ ] Test connection works

**5. Import Test:**

```bash
# Test AI import endpoint
curl -X POST https://trilium.example.com/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/TriliumNext/Trilium"}'
```

### Backup Configuration

**1. Automated Backups:**

Create backup script `/opt/trilium/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/trilium"
DATA_DIR="/opt/trilium-data"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
sqlite3 "$DATA_DIR/document.db" ".backup '$BACKUP_DIR/trilium_$TIMESTAMP.db'"

# Backup config
cp "$DATA_DIR/config.ini" "$BACKUP_DIR/config_$TIMESTAMP.ini"

# Keep only last 7 days
find "$BACKUP_DIR" -name "trilium_*.db" -mtime +7 -delete
find "$BACKUP_DIR" -name "config_*.ini" -mtime +7 -delete

echo "Backup completed: $TIMESTAMP"
```

**2. Setup Cron Job:**

```bash
# Make executable
chmod +x /opt/trilium/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /opt/trilium/backup.sh >> /var/log/trilium/backup.log 2>&1
```

**3. Verify Backups:**

```bash
# List recent backups
ls -lh /backups/trilium/

# Test restore (to temp location)
sqlite3 /tmp/test.db ".restore '/backups/trilium/trilium_20260130_020000.db'"
sqlite3 /tmp/test.db "PRAGMA integrity_check;"
```

### Monitoring Setup

**1. Application Monitoring:**

Use PM2 monitoring (if using PM2):
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

**2. System Monitoring:**

Install monitoring tools:
```bash
# Netdata for comprehensive monitoring
bash <(curl -Ss https://get.netdata.cloud/kickstart.sh)
```

**3. Log Monitoring:**

Setup log rotation for systemd:
```bash
# Create /etc/systemd/journald.conf.d/trilium.conf
[Journal]
SystemMaxUse=500M
SystemKeepFree=1G
MaxRetentionSec=1week
```

**4. Uptime Monitoring:**

Use external service (e.g., UptimeRobot, Pingdom) to monitor:
- URL: `https://trilium.example.com/api/health`
- Interval: 5 minutes
- Alert on: HTTP 500, timeout, or SSL errors

## Troubleshooting

### Common Issues

**1. Port Already in Use:**

```bash
# Find process using port 8080
sudo lsof -i :8080
sudo netstat -tulpn | grep 8080

# Kill the process
sudo kill -9 <PID>
```

**2. Permission Denied:**

```bash
# Fix data directory permissions
sudo chown -R trilium:trilium /opt/trilium-data
chmod 700 /opt/trilium-data
```

**3. Database Locked:**

```sql
-- Check for active connections
sqlite3 /opt/trilium-data/document.db "PRAGMA busy_timeout = 3000;"

-- If persistent, restart Trilium
sudo systemctl restart trilium
```

**4. Memory Issues:**

```bash
# Check memory usage
free -h
ps aux | grep node

# Increase memory limit
# PM2: Update ecosystem.config.js max_memory_restart
# systemd: Update MemoryMax in service file
# Docker: Use -m flag
```

**5. SSL Certificate Issues:**

```bash
# Verify certificate
sudo certbot certificates

# Renew manually
sudo certbot renew

# Test Nginx config
sudo nginx -t
```

**6. AI Import Not Working:**

Check AI configuration:
1. Settings > AI > Provider selected?
2. API key configured?
3. Model selected?
4. Test connection in UI

Check logs:
```bash
# Look for AI-related errors
journalctl -u trilium | grep -i "ai\|llm\|openai\|anthropic"
```

### Log Locations

| Deployment | Log Location |
|------------|--------------|
| systemd | `journalctl -u trilium -f` |
| PM2 | `~/.pm2/logs/` or `pm2 logs` |
| Docker | `docker logs trilium -f` |
| Manual | `{DATA_DIR}/log/` |

### Debug Mode

Enable verbose logging:

```bash
# Environment variable
DEBUG=* node dist/main.cjs

# Or in PM2 ecosystem.config.js
env: {
  DEBUG: 'trilium:*'
}
```

### Getting Help

- **Documentation**: https://triliumnotes.org/docs
- **GitHub Issues**: https://github.com/TriliumNext/Trilium/issues
- **Discord**: https://discord.gg/triliumnext
- **Forum**: https://github.com/TriliumNext/Trilium/discussions

---

**Next Steps:**
- Review [CONFIGURATION.md](./CONFIGURATION.md) for detailed settings
- Setup automated backups
- Configure monitoring
- Review security hardening checklist
