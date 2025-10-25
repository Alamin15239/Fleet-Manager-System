# Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis (optional, for caching)
- Domain name with SSL certificate

## Environment Setup

1. Copy production environment file:
```bash
cp .env.production.example .env.production
```

2. Update all environment variables with production values

## Database Setup

1. Create production database:
```bash
createdb fleet_management
```

2. Run migrations:
```bash
npm run db:migrate:deploy
```

3. Generate Prisma client:
```bash
npm run db:generate
```

## Docker Deployment

### Build Image
```bash
docker build -t fleet-manager:latest .
```

### Run Container
```bash
docker run -d \
  --name fleet-manager \
  -p 3000:3000 \
  --env-file .env.production \
  fleet-manager:latest
```

### With Docker Compose
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Vercel Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel --prod
```

4. Set environment variables in Vercel dashboard

## Traditional Server Deployment

### Using PM2

1. Install PM2:
```bash
npm install -g pm2
```

2. Build application:
```bash
npm run build
```

3. Start with PM2:
```bash
pm2 start npm --name "fleet-manager" -- start
pm2 save
pm2 startup
```

### Using Nginx

1. Install Nginx:
```bash
sudo apt install nginx
```

2. Configure Nginx:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Enable SSL with Let's Encrypt:
```bash
sudo certbot --nginx -d yourdomain.com
```

## Post-Deployment

1. Run database backup:
```bash
npm run db:backup
```

2. Set up cron job for automated backups:
```bash
crontab -e
# Add: 0 2 * * * cd /path/to/app && npm run db:backup
```

3. Monitor application logs:
```bash
pm2 logs fleet-manager
# or
docker logs -f fleet-manager
```

## Health Checks

Test endpoints:
- `GET /api/health` - Application health
- `GET /api/db-health` - Database connectivity

## Rollback

### Docker
```bash
docker stop fleet-manager
docker run -d --name fleet-manager fleet-manager:previous-tag
```

### PM2
```bash
pm2 stop fleet-manager
git checkout previous-commit
npm run build
pm2 restart fleet-manager
```

## Monitoring

1. Set up Sentry for error tracking
2. Configure uptime monitoring (UptimeRobot, Pingdom)
3. Set up log aggregation (Datadog, LogRocket)
4. Monitor database performance

## Security Checklist

- [ ] All secrets in environment variables
- [ ] SSL/TLS enabled
- [ ] Database backups configured
- [ ] Rate limiting enabled
- [ ] CORS configured properly
- [ ] Security headers set
- [ ] Regular dependency updates
- [ ] Firewall rules configured

## Performance Optimization

1. Enable Redis caching
2. Configure CDN for static assets
3. Enable database connection pooling
4. Set up load balancing for high traffic
5. Monitor and optimize slow queries

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql $DATABASE_URL
```

### Application Won't Start
```bash
# Check logs
pm2 logs fleet-manager

# Verify environment variables
printenv | grep DATABASE_URL
```

### High Memory Usage
```bash
# Monitor resources
pm2 monit

# Restart application
pm2 restart fleet-manager
```
