# Production Deployment Guide

## Prerequisites

1. Node.js and pnpm installed on the server
2. PostgreSQL database set up and accessible
3. Nginx installed and configured
4. `.env` file on the server with database credentials

## Server Setup

### 1. Install Dependencies

On your local machine:
```bash
pnpm install
```

### 2. Update Nginx Configuration

Add API proxy to your nginx config (`/etc/nginx/sites-available/contex.intently.gg`):

```nginx
server {
    server_name contex.intently.gg;
    root /var/www/contex;
    index index.html;

    # Proxy API requests to Node.js server
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

 <additional SSL stuff>
}
```

Then reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Create `.env` File on Server

Create `/var/www/contex/.env` with:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=contex
PORT=3000
NODE_ENV=production
```

### 4. Initial Systemd Service Setup

On the server, copy the service file and enable it:
```bash
sudo cp /var/www/contex/contex.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable contex.service
sudo systemctl start contex.service
```

## Deployment

Simply run the deploy script:
```bash
./scripts/deploy.sh
```

The script will:
1. Build the project
2. Sync static files to `dist/` directory
3. Sync server files (server.js, package.json, contex.service)
4. Install/update dependencies on server
5. Update systemd service
6. Restart the service

## Manual Deployment Steps

If you need to deploy manually:

1. Build locally:
   ```bash
   pnpm build
   ```

2. Sync files to server:
   ```bash
   rsync -avz dist/ user@server:/var/www/contex/dist/
   rsync -avz server.js package.json contex.service user@server:/var/www/contex/
   ```

3. On server, install dependencies:
   ```bash
   cd /var/www/contex
   pnpm install --production
   ```

4. Restart service:
   ```bash
   sudo systemctl restart contex.service
   ```

## Service Management

```bash
# Check status
sudo systemctl status contex.service

# View logs
sudo journalctl -u contex.service -f

# Restart service
sudo systemctl restart contex.service

# Stop service
sudo systemctl stop contex.service

# Start service
sudo systemctl start contex.service
```

## Troubleshooting

### Service won't start
- Check logs: `sudo journalctl -u contex.service -n 50`
- Verify `.env` file exists and has correct values
- Check database connection: `psql -h localhost -U postgres -d contex`
- Verify Node.js is installed: `which node`

### API endpoints return 502
- Check if service is running: `sudo systemctl status contex.service`
- Check if port 3000 is in use: `sudo netstat -tlnp | grep 3000`
- Verify nginx proxy_pass is correct

### Database connection errors
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check database credentials in `.env`
- Test connection: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME`

