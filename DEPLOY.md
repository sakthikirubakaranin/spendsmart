# SpendSmart — Production Deployment Guide

Stack: FastAPI → GCP Cloud Run | React → Firebase Hosting | Neon PostgreSQL | Upstash Redis

---

## Prerequisites

- GCP project created (note your **Project ID**)
- Firebase project created (can be the same GCP project)
- GitHub repo with this code pushed to `main`
- `gcloud` CLI installed locally
- `firebase` CLI installed locally (`npm install -g firebase-tools`)

---

## Step 1 — GCP Setup (one-time)

### 1a. Enable required APIs
```bash
gcloud config set project YOUR_PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 1b. Create a Service Account for GitHub Actions
```bash
gcloud iam service-accounts create github-actions \
  --display-name "GitHub Actions"

# Grant required roles
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Export JSON key (this goes into GitHub secret GCP_SA_KEY)
gcloud iam service-accounts keys create gcp-sa-key.json \
  --iam-account=github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 1c. Store secrets in Secret Manager (never put secrets in Cloud Run env vars directly)
```bash
# Database
echo -n "postgresql://neondb_owner:...@.../neondb?sslmode=require" | \
  gcloud secrets create spendsmart-database-url --data-file=-

# Redis
echo -n "rediss://default:...@cosmic-akita-118022.upstash.io:6379" | \
  gcloud secrets create spendsmart-redis-url --data-file=-

# JWT
echo -n "cdbc512420f1bb8a90a834c851c8697d3e30224ff4b5e8d683ca2269830ca5b9" | \
  gcloud secrets create spendsmart-jwt-secret --data-file=-

# Email (add later when you have Gmail App Password or SendGrid key)
echo -n "your-gmail@gmail.com" | \
  gcloud secrets create spendsmart-mail-username --data-file=-

echo -n "your-app-password-here" | \
  gcloud secrets create spendsmart-mail-password --data-file=-

# Allow Cloud Run to read secrets
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 2 — Firebase Setup (one-time)

### 2a. Log in and init hosting
```bash
cd spendsmart-ui
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
```

### 2b. Update .firebaserc
Edit `spendsmart-ui/.firebaserc` → replace `YOUR_FIREBASE_PROJECT_ID` with your actual project ID.

### 2c. Get Firebase Service Account for GitHub Actions
Go to: Firebase Console → Project Settings → Service Accounts → Generate new private key

Download the JSON file — this goes into GitHub secret `FIREBASE_SERVICE_ACCOUNT`.

---

## Step 3 — GitHub Secrets (one-time)

Go to: GitHub repo → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Value |
|-------------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_SA_KEY` | Contents of `gcp-sa-key.json` (full JSON) |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT` | Contents of Firebase service account JSON |
| `VITE_API_URL` | Set AFTER first backend deploy (see Step 4) |
| `FRONTEND_URL` | Your Firebase Hosting URL (e.g. `https://YOUR_APP.web.app`) |

---

## Step 4 — First Deploy

### 4a. Deploy backend manually (first time only, to get the URL)
```bash
cd spendsmart-api

# Build and push
docker build -t gcr.io/YOUR_PROJECT_ID/spendsmart-api:latest .
docker push gcr.io/YOUR_PROJECT_ID/spendsmart-api:latest

# Deploy
gcloud run deploy spendsmart-api \
  --image gcr.io/YOUR_PROJECT_ID/spendsmart-api:latest \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars "APP_ENV=production,FRONTEND_URL=https://YOUR_APP.web.app" \
  --set-secrets "DATABASE_URL=spendsmart-database-url:latest,REDIS_URL=spendsmart-redis-url:latest,JWT_SECRET=spendsmart-jwt-secret:latest,MAIL_USERNAME=spendsmart-mail-username:latest,MAIL_PASSWORD=spendsmart-mail-password:latest"
```

Note the URL printed at the end: `https://spendsmart-api-XXXXXXXX-el.a.run.app`

### 4b. Run database migrations
```bash
# One-time: run Alembic migrations against Neon
# (Neon is already set up, just ensure tables exist)
DATABASE_URL="your-neon-url" alembic upgrade head
```

### 4c. Update GitHub secret
Add `VITE_API_URL` = `https://spendsmart-api-XXXXXXXX-el.a.run.app/api/v1`

### 4d. Deploy frontend
```bash
cd spendsmart-ui
VITE_API_URL=https://spendsmart-api-XXXXXXXX-el.a.run.app/api/v1 npm run build
firebase deploy
```

Note your Hosting URL: `https://YOUR_APP.web.app`

---

## Step 5 — After First Deploy (CI/CD is live)

From now on:
- Push to `main` with changes in `spendsmart-api/` → backend auto-deploys to Cloud Run
- Push to `main` with changes in `spendsmart-ui/` → frontend auto-deploys to Firebase Hosting

---

## Step 6 — Email (Forgot Password)

The OTP emails won't send until SMTP is configured. Two options:

**Option A — Gmail App Password (free, easiest)**
1. Enable 2FA on your Gmail account
2. Go to myaccount.google.com → Security → App passwords
3. Generate password for "Mail"
4. Update secrets:
```bash
echo -n "your-gmail@gmail.com" | gcloud secrets versions add spendsmart-mail-username --data-file=-
echo -n "xxxx xxxx xxxx xxxx"  | gcloud secrets versions add spendsmart-mail-password --data-file=-
```

**Option B — SendGrid (better for production)**
1. Create account at sendgrid.com (100 emails/day free)
2. Create API key
3. Update `MAIL_SERVER=smtp.sendgrid.net`, `MAIL_PORT=587`, username=`apikey`, password=your API key

---

## Custom Domain (optional)

**Backend**: Cloud Run supports custom domains under "Domain Mappings" in the console.
**Frontend**: Firebase Hosting → Custom domain → follow the DNS instructions.

---

## Scaling Notes

| Service | Free Tier | When to Upgrade |
|---------|-----------|-----------------|
| Cloud Run | 2M req/month, 360k GB-sec | When you exceed free quota |
| Firebase Hosting | 10 GB storage, 360 MB/day transfer | At ~50k monthly users |
| Neon PostgreSQL | 0.5 GB, 1 compute unit | Upgrade to Pro ($19/mo) at ~1k users |
| Upstash Redis | 10k commands/day | Upgrade to pay-per-use at ~500 users |
