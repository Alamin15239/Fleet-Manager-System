# Vercel Deployment Guide

This guide will help you deploy the Fleet Manager application to Vercel.

## 🚀 Quick Deployment

### 1. Prerequisites

- GitHub account
- Vercel account (free tier available)
- Production database (PostgreSQL recommended)
- Resend API key for email functionality

### 2. Database Setup

#### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Create a new project or select existing
3. Go to Storage tab
4. Create a new Postgres database
5. Copy the connection string

#### Option B: External Database (Neon, PlanetScale, etc.)
1. Create a PostgreSQL database on your preferred provider
2. Get the connection string
3. Ensure the database allows connections from Vercel

### 3. Deploy to Vercel

#### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables**:
   Add these in Vercel dashboard → Settings → Environment Variables:

   ```env
   DATABASE_URL=your-postgres-connection-string
   JWT_SECRET=your-super-secure-jwt-secret-32-chars-min
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   RESEND_API_KEY=re_your_resend_api_key
   EMAIL_FROM=Fleet Manager <noreply@yourdomain.com>
   NODE_ENV=production
   ```

4. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy automatically

#### Method 2: Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### 4. Post-Deployment Setup

#### Database Migration
After deployment, run database migrations:

1. **Using Vercel CLI**:
   ```bash
   vercel env pull .env.local
   npx prisma db push
   ```

2. **Or create a deployment script**:
   Add to `package.json`:
   ```json
   {
     "scripts": {
       "vercel-build": "prisma generate && prisma db push && next build"
     }
   }
   ```

#### Create Admin User
1. Access your deployed app
2. Register the first user
3. Manually set their role to ADMIN in the database
4. Or use the setup script (if available)

### 5. Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | ✅ | JWT signing secret (32+ chars) | `your-super-secure-secret-key` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your app's URL | `https://fleet-manager.vercel.app` |
| `RESEND_API_KEY` | ✅ | Resend email API key | `re_abc123...` |
| `EMAIL_FROM` | ✅ | Email sender address | `Fleet Manager <noreply@domain.com>` |
| `NODE_ENV` | ✅ | Environment | `production` |
| `UPLOAD_MAX_SIZE` | ❌ | Max file upload size | `10485760` |
| `ALLOWED_FILE_TYPES` | ❌ | Allowed file types | `image/jpeg,image/png` |

### 6. Custom Domain (Optional)

1. **Add Domain in Vercel**:
   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update Environment Variables**:
   ```env
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   EMAIL_FROM=Fleet Manager <noreply@yourdomain.com>
   ```

## 🔧 Troubleshooting

### Common Issues

#### 1. Build Failures

**Error**: `Module not found` or `Cannot resolve module`
```bash
# Solution: Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Error**: `Prisma Client not generated`
```bash
# Solution: Add to vercel.json
{
  "buildCommand": "prisma generate && next build"
}
```

#### 2. Database Connection Issues

**Error**: `Can't reach database server`
- Check DATABASE_URL format
- Ensure database allows Vercel IP ranges
- Verify SSL settings (add `?sslmode=require` if needed)

**Error**: `Table doesn't exist`
```bash
# Solution: Run migrations
npx prisma db push
# or
npx prisma migrate deploy
```

#### 3. Environment Variable Issues

**Error**: `JWT_SECRET is not defined`
- Verify all environment variables are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)
- Redeploy after adding variables

#### 4. Email Issues

**Error**: `RESEND_API_KEY not found`
- Add Resend API key to environment variables
- Verify the key is valid and active
- Check email domain verification in Resend

### Performance Optimization

1. **Enable Edge Runtime** (optional):
   ```javascript
   // In API routes
   export const runtime = 'edge'
   ```

2. **Optimize Images**:
   ```javascript
   // next.config.js
   module.exports = {
     images: {
       domains: ['your-domain.com'],
       formats: ['image/webp', 'image/avif']
     }
   }
   ```

3. **Enable Compression**:
   ```javascript
   // next.config.js
   module.exports = {
     compress: true,
     poweredByHeader: false
   }
   ```

## 📊 Monitoring

### 1. Vercel Analytics
- Enable in Project Settings → Analytics
- Monitor performance and usage

### 2. Error Tracking
Add Sentry for error monitoring:
```bash
npm install @sentry/nextjs
```

### 3. Uptime Monitoring
Use services like:
- Vercel's built-in monitoring
- UptimeRobot
- Pingdom

## 🔄 CI/CD Pipeline

### Automatic Deployments
Vercel automatically deploys when you push to your main branch.

### Preview Deployments
- Every pull request gets a preview deployment
- Test changes before merging

### Environment-Specific Deployments
```bash
# Production
git push origin main

# Staging (if configured)
git push origin staging
```

## 📋 Deployment Checklist

- [ ] Database created and accessible
- [ ] All environment variables configured
- [ ] Resend API key obtained and configured
- [ ] Domain configured (if using custom domain)
- [ ] Database migrations run
- [ ] Admin user created
- [ ] Email functionality tested
- [ ] File uploads tested
- [ ] Performance monitoring enabled
- [ ] Error tracking configured
- [ ] Backup strategy in place

## 🆘 Support

### Vercel Support
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

### Application Support
- Check application logs in Vercel dashboard
- Review error messages in browser console
- Test API endpoints individually

### Database Support
- Monitor database performance
- Check connection limits
- Review query performance

---

**Last Updated**: January 2024  
**Vercel Version**: Latest  
**Next.js Version**: 15.3.5