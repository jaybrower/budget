# Deployment Guide

This guide covers deploying the Budget application to production using GitHub Actions and recommended hosting providers.

## Table of Contents

- [Hosting Recommendations](#hosting-recommendations)
- [Pre-deployment Setup](#pre-deployment-setup)
- [Deployment Options](#deployment-options)
- [GitHub Actions Setup](#github-actions-setup)
- [Environment Variables](#environment-variables)
- [Database Migration](#database-migration)

## Hosting Recommendations

### Option 1: Render.com (Recommended for Beginners)

**Best for**: Simple setup, all-in-one platform

**Pricing**:
- PostgreSQL: Free tier (90 days) then $7/month for 1GB
- API Service: Free tier (slow cold starts) or $7/month for always-on
- Static Site (UI): Free with CDN
- **Total**: $0-14/month

**Pros**:
- Easy setup with GitHub integration
- Auto-deploy on git push
- Free SSL certificates
- Managed PostgreSQL backups
- Environment variable management

**Cons**:
- Free tier has slow cold starts (30-60 second delay)
- More expensive than some alternatives for scale

### Option 2: Railway.app

**Best for**: Developer experience, simple pricing

**Pricing**: ~$5-15/month (pay-as-you-go)

**Pros**:
- Excellent developer experience
- Usage-based pricing
- Fast deployments
- Database, API, and static hosting all included

**Cons**:
- No free tier (but very affordable)

### Option 3: Vercel + Render (Best Performance/Cost Ratio)

**Best for**: Optimal performance for UI, cost-effective

**Setup**:
- UI on Vercel (free, unlimited bandwidth)
- API + Database on Render ($7/month minimum)

**Total**: $7/month

**Pros**:
- Vercel has excellent UI performance and CDN
- Free UI hosting with great DX
- Render for backend simplicity

### Option 4: Fly.io

**Best for**: Advanced users, global edge deployment

**Pricing**: ~$5-10/month

**Pros**:
- Deploy API close to users globally
- Good free tier
- Docker-based deployment

**Cons**:
- Steeper learning curve
- Requires Dockerfile creation

## Pre-deployment Setup

### 1. Generate Production Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate encryption key
openssl rand -base64 32
```

### 2. Encrypt Sensitive Values

Use the encryption utility to encrypt sensitive values:

```bash
cd api
npm run encrypt-secret
```

Encrypt the following:
- Database password (if using individual DB credentials)
- Plaid client ID
- Plaid secret key
- reCAPTCHA secret key

### 3. Get API Keys

- **Plaid**: Sign up at https://dashboard.plaid.com/ and get production credentials
- **reCAPTCHA**: Create a site at https://www.google.com/recaptcha/admin

## Deployment Options

### Deploying to Render.com

#### Step 1: Create PostgreSQL Database

1. Go to https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Configure:
   - Name: `budget-db`
   - Database: `budget`
   - User: `budget_user` (auto-generated)
   - Region: Choose closest to your users
   - Plan: Free (or Starter $7/month for production)
4. Click "Create Database"
5. **Save the connection details** (especially the External Database URL)

#### Step 2: Run Database Migrations

Option A: Using Render Shell
1. Once DB is created, go to "Shell" tab
2. Connect to your database
3. Run migration scripts from `database/*.sql` in order

Option B: Using Local psql
```bash
# Set the DATABASE_URL from Render
export DATABASE_URL="postgresql://user:password@host/dbname"

# Run migrations
psql $DATABASE_URL -f database/000_run_all.sql
```

#### Step 3: Create API Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `budget-api`
   - Root Directory: `api`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free (or Starter $7/month)
4. Add Environment Variables (see [Environment Variables](#environment-variables) section)
5. Click "Create Web Service"
6. **Copy the service URL** (e.g., `https://budget-api.onrender.com`)

#### Step 4: Create Static Site (UI)

1. Click "New +" → "Static Site"
2. Connect your GitHub repository
3. Configure:
   - Name: `budget-ui`
   - Root Directory: `ui`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
4. Add Environment Variables:
   ```
   VITE_API_URL=https://budget-api.onrender.com
   VITE_RECAPTCHA_SITE_KEY=<your-recaptcha-site-key>
   VITE_PLAID_ENV=production
   ```
5. Click "Create Static Site"

#### Step 5: Enable Auto-Deploy with GitHub Actions

1. In Render dashboard, go to your API service
2. Click "Settings" → "Deploy Hook"
3. Copy the deploy hook URL
4. Go to your GitHub repository → Settings → Secrets and variables → Actions
5. Add secret: `RENDER_DEPLOY_HOOK_URL_API` with the URL value
6. Repeat for UI static site: `RENDER_DEPLOY_HOOK_URL_UI`

Now GitHub Actions will auto-deploy on push to main!

### Deploying to Vercel (UI) + Render (API + DB)

#### Step 1: Setup API and Database on Render
Follow Render steps above for API and Database only.

#### Step 2: Deploy UI to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy from the UI directory:
   ```bash
   cd ui
   vercel
   ```

3. Follow prompts and set environment variables:
   - `VITE_API_URL`: Your Render API URL
   - `VITE_RECAPTCHA_SITE_KEY`: Your reCAPTCHA site key
   - `VITE_PLAID_ENV`: `production`

4. For GitHub Actions integration, get Vercel token:
   - Go to https://vercel.com/account/tokens
   - Create a token
   - Add to GitHub secrets as `VERCEL_TOKEN`

5. Get Project and Org IDs:
   ```bash
   cd ui
   vercel link
   cat .vercel/project.json
   ```
   Add to GitHub secrets:
   - `VERCEL_PROJECT_ID`
   - `VERCEL_ORG_ID`

6. Uncomment Vercel deployment step in `.github/workflows/ui-deploy.yml`

### Deploying to Railway.app

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will auto-detect your services
6. Add PostgreSQL:
   - Click "+ New" → "Database" → "PostgreSQL"
7. Configure environment variables for API service
8. Deploy!

Railway auto-generates URLs and handles SSL certificates.

## GitHub Actions Setup

The repository includes two workflow files:

### UI Deployment (`.github/workflows/ui-deploy.yml`)

Triggers on:
- Push to `main` branch with changes to `ui/` directory
- Manual workflow dispatch

Uncomment the deployment step for your chosen provider (Vercel, Render, or Netlify).

### API Deployment (`.github/workflows/api-deploy.yml`)

Triggers on:
- Push to `main` branch with changes to `api/` directory
- Manual workflow dispatch

Uses deploy hooks (Render) or direct deployment (Railway, Fly.io).

### Required GitHub Secrets

Add these secrets in your GitHub repository settings:

**For Render deployment:**
- `RENDER_DEPLOY_HOOK_URL_API`
- `RENDER_DEPLOY_HOOK_URL_UI` (if using Render for UI)

**For Vercel deployment (UI only):**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_API_URL`
- `VITE_RECAPTCHA_SITE_KEY`
- `VITE_PLAID_ENV`

**For Railway deployment:**
- `RAILWAY_TOKEN`

## Environment Variables

### API Service

Copy from `api/.env.production.example` and configure:

**Required:**
```bash
# Database - use DATABASE_URL from your hosting provider
DATABASE_URL=postgresql://user:password@host:5432/dbname

# JWT - generate with: openssl rand -base64 32
JWT_SECRET=<your-secret>

# Encryption key - generate with: openssl rand -base64 32
ENCRYPTION_KEY=<your-key>

# Plaid credentials (encrypted)
PLAID_CLIENT_ID_ENCRYPTED=<encrypted-value>
PLAID_SECRET_ENCRYPTED=<encrypted-value>
PLAID_ENV=production

# reCAPTCHA (encrypted)
RECAPTCHA_SECRET_KEY=<encrypted-value>
```

**Optional:**
```bash
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
JWT_EXPIRES_IN=24h
PLAID_PRODUCTS=transactions
PLAID_COUNTRY_CODES=US
```

### UI Build Variables

Required at build time (set in hosting provider or GitHub Actions):

```bash
VITE_API_URL=https://your-api-url.com
VITE_RECAPTCHA_SITE_KEY=<your-recaptcha-site-key>
VITE_PLAID_ENV=production
```

## Database Migration

### Initial Setup

Run the migration scripts in order:

```bash
# If your hosting provider gives you a DATABASE_URL
export DATABASE_URL="<your-database-url>"

# Run all migrations
psql $DATABASE_URL -f database/000_run_all.sql
```

Or run individually in order:
```bash
psql $DATABASE_URL -f database/001_create_users.sql
psql $DATABASE_URL -f database/002_create_budget_templates.sql
# ... continue through all files
```

### Future Migrations

For schema changes:
1. Add new migration file: `database/XXX_description.sql`
2. Update `database/000_run_all.sql` to include new file
3. Run migration on production database
4. Commit and push changes

## Post-Deployment Checklist

- [ ] Database is created and migrations are run
- [ ] API service is running and health check passes: `GET https://your-api.com/health`
- [ ] UI is deployed and can access API
- [ ] Environment variables are set correctly
- [ ] GitHub Actions workflows are enabled
- [ ] Deploy hooks are configured (if using Render)
- [ ] SSL certificates are active (usually automatic)
- [ ] CORS is configured if UI and API are on different domains
- [ ] Test user registration and login
- [ ] Test Plaid integration
- [ ] Test reCAPTCHA on registration

## Monitoring and Maintenance

### Health Checks

Your API includes a health endpoint:
```bash
curl https://your-api.com/health
```

Returns 200 OK if the service is running.

### Database Backups

**Render**: Automatic daily backups on paid plans
**Railway**: Automatic backups included
**Vercel**: N/A (static hosting)

### Logs

- **Render**: View logs in dashboard or use Render CLI
- **Railway**: Built-in log viewer
- **Vercel**: Function logs and deployment logs in dashboard

### Costs Monitoring

Most providers have usage dashboards. Set up billing alerts to avoid surprises.

## Troubleshooting

### API won't start

1. Check environment variables are set correctly
2. Verify DATABASE_URL is correct
3. Check logs for errors
4. Ensure database migrations ran successfully

### UI can't connect to API

1. Check VITE_API_URL is set correctly at build time
2. Verify CORS settings if API and UI are on different domains
3. Check API is running: `curl https://your-api.com/health`

### Database connection errors

1. Verify DATABASE_URL format
2. Check database is running and accessible
3. Verify firewall rules allow connections
4. Check if encrypted password is being decrypted correctly

### GitHub Actions failing

1. Verify all required secrets are set in repository
2. Check workflow logs for specific errors
3. Ensure deploy hook URLs are correct
4. Verify API tokens are valid

## Support

For issues with:
- **Render**: https://render.com/docs
- **Vercel**: https://vercel.com/docs
- **Railway**: https://docs.railway.app
- **GitHub Actions**: https://docs.github.com/en/actions
