# Fleet Manager System - Development Deployment Guide

## Quick Deployment to Vercel

### 1. Prerequisites
- GitHub account with your repository
- Vercel account (free tier available)
- Database provider (Vercel Postgres recommended)

### 2. Deploy to Vercel

#### Option A: One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Alamin15239/Fleet-Manager-System&branch=development)

#### Option B: Manual Deployment

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with GitHub

2. **Import Project**
   - Click "New Project"
   - Import from GitHub: `Alamin15239/Fleet-Manager-System`
   - Select the `development` branch

3. **Configure Environment Variables**
   Copy these variables to Vercel:
   ```
   DATABASE_URL=postgresql://username:password@host:port/database
   JWT_SECRET=your-32-character-secret-key
   NEXTAUTH_URL=https://your-app.vercel.app
   NEXTAUTH_SECRET=your-nextauth-secret
   RESEND_API_KEY=your-resend-api-key
   EMAIL_FROM=Fleet Manager Dev <noreply@yourdomain.com>
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete

### 3. Database Setup

#### Option A: Vercel Postgres (Recommended)
1. In Vercel dashboard, go to your project
2. Click "Storage" tab
3. Create "Postgres" database
4. Copy connection string to `DATABASE_URL`

#### Option B: External PostgreSQL
1. Use any PostgreSQL provider (Railway, Supabase, etc.)
2. Create database and user
3. Add connection string to environment variables

### 4. Post-Deployment Setup

1. **Initialize Database**
   - Vercel will automatically run `prisma generate` and `prisma db push`
   - Database tables will be created automatically

2. **Create Admin User**
   - Visit your deployed app
   - Register first user (will be admin by default)

3. **Test Application**
   - Login with admin account
   - Add sample trucks and tires
   - Test all features

### 5. Development Workflow

```bash
# Work on development branch
git checkout development

# Make changes
# Test locally
npm run dev

# Commit and push
git add .
git commit -m "Your changes"
git push origin development

# Vercel will auto-deploy development branch
```

### 6. Production Sync

When ready to update production:
```bash
# Switch to main branch
git checkout main

# Merge development changes
git merge development

# Push to production
git push origin main
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | 32+ character secret for JWT | Yes |
| `NEXTAUTH_URL` | Your app URL | Yes |
| `NEXTAUTH_SECRET` | NextAuth secret | Yes |
| `RESEND_API_KEY` | Email service API key | Yes |
| `EMAIL_FROM` | From email address | Yes |
| `NEXT_PUBLIC_APP_URL` | Public app URL | Yes |
| `OPENAI_API_KEY` | AI features (optional) | No |

## Troubleshooting

### Build Errors
- Check environment variables are set
- Ensure DATABASE_URL is valid
- Verify all required secrets are configured

### Database Issues
- Run `npx prisma db push` locally first
- Check database connection string
- Ensure database exists and is accessible

### Email Issues
- Verify Resend API key
- Check email domain configuration
- Test with development email first

## Support

- GitHub Issues: [Create Issue](https://github.com/Alamin15239/Fleet-Manager-System/issues)
- Development Branch: `development`
- Production Branch: `main`