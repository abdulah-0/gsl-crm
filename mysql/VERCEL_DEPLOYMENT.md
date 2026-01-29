# Deploying MySQL API to Vercel - Complete Guide

This guide will walk you through deploying your MySQL-based GSL CRM API to Vercel.

## 🎯 Overview

To deploy the MySQL API to Vercel, you'll need:

1. **MySQL Database Hosting** - Vercel doesn't host databases, so you need a separate MySQL host
2. **Serverless API Functions** - Convert Express app to Vercel serverless functions
3. **Environment Variables** - Configure MySQL credentials in Vercel
4. **Frontend Updates** - Point your frontend to the Vercel API

## 📋 Prerequisites

- Vercel account (free tier works)
- GitHub repository with your code
- MySQL database hosting (see options below)

---

## Step 1: Choose MySQL Database Hosting

Vercel doesn't provide MySQL hosting, so you need to use a third-party service. Here are the best options:

### Option A: PlanetScale (Recommended) ⭐

**Pros:**
- Free tier available (5GB storage)
- Serverless MySQL (scales automatically)
- Built for Vercel deployment
- Easy to use
- No connection limits

**Setup:**
1. Go to [planetscale.com](https://planetscale.com)
2. Sign up and create a new database
3. Get connection string
4. Import your schema

**Pricing:** Free tier → $29/month for production

### Option B: Railway

**Pros:**
- Free $5 credit monthly
- Easy setup
- Good for development

**Setup:**
1. Go to [railway.app](https://railway.app)
2. Create new MySQL database
3. Get connection details

**Pricing:** Pay-as-you-go after free credit

### Option C: AWS RDS

**Pros:**
- Enterprise-grade
- Highly scalable
- Full control

**Cons:**
- More complex setup
- More expensive

**Pricing:** Starts at ~$15/month

### Option D: DigitalOcean Managed MySQL

**Pros:**
- Reliable
- Good pricing
- Easy to manage

**Pricing:** Starts at $15/month

---

## Step 2: Set Up Your MySQL Database

I'll use **PlanetScale** as an example (recommended):

### A. Create PlanetScale Database

```bash
# Install PlanetScale CLI (optional)
brew install planetscale/tap/pscale

# Or use the web interface at planetscale.com
```

### B. Create Database via Web UI

1. Go to [planetscale.com](https://planetscale.com)
2. Click "Create database"
3. Name it: `gsl-crm`
4. Choose region closest to your users
5. Click "Create database"

### C. Get Connection String

1. Go to your database dashboard
2. Click "Connect"
3. Select "General" or "Node.js"
4. Copy the connection details:

```
Host: aws.connect.psdb.cloud
Username: xxxxxxxxx
Password: pscale_pw_xxxxxxxxx
Database: gsl-crm
```

### D. Import Schema

**Option 1: Using PlanetScale CLI**
```bash
pscale shell gsl-crm main < mysql/schema/complete_schema.sql
```

**Option 2: Using MySQL Client**
```bash
mysql -h aws.connect.psdb.cloud -u your_username -p your_database < mysql/schema/complete_schema.sql
```

**Option 3: Using Web Console**
- Go to PlanetScale Console
- Click "Console" tab
- Copy and paste schema SQL
- Execute

---

## Step 3: Convert Express App to Vercel Serverless Functions

Vercel uses serverless functions, so we need to adapt our Express app.

### A. Create Vercel Configuration

Create `vercel.json` in your project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/mysql/server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/mysql/(.*)",
      "dest": "api/mysql/server.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### B. Update Server for Serverless

The current `server.ts` needs a small modification. Create a new file:

**`api/mysql/index.ts`** (Vercel entry point):

```typescript
import app from './server';

// Export for Vercel serverless
export default app;
```

### C. Update `server.ts`

Modify the export at the end of `api/mysql/server.ts`:

```typescript
// Remove or comment out the startServer() call
// if (require.main === module) {
//   startServer();
// }

// Export the app for Vercel
export default app;
```

---

## Step 4: Configure Environment Variables in Vercel

### A. Go to Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Go to Project Settings → Environment Variables

### B. Add MySQL Variables

Add these environment variables:

```
MYSQL_HOST=aws.connect.psdb.cloud
MYSQL_PORT=3306
MYSQL_USER=your_planetscale_username
MYSQL_PASSWORD=your_planetscale_password
MYSQL_DATABASE=gsl-crm

# For PlanetScale, you may need SSL
MYSQL_SSL=true

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# Node Environment
NODE_ENV=production
```

### C. PlanetScale Specific Settings

If using PlanetScale, you might need to adjust the connection config:

Update `mysql/config/database.ts`:

```typescript
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'gsl_crm',
  
  // PlanetScale specific
  ssl: process.env.MYSQL_SSL === 'true' ? {
    rejectUnauthorized: true
  } : undefined,
  
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};
```

---

## Step 5: Update package.json for Vercel

Add a build script if not present:

```json
{
  "scripts": {
    "build": "tsc",
    "vercel-build": "echo 'Build complete'"
  }
}
```

---

## Step 6: Deploy to Vercel

### A. Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

### B. Using GitHub Integration (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset:** Other
   - **Root Directory:** ./
   - **Build Command:** npm run build
   - **Output Directory:** (leave empty)
4. Add environment variables (from Step 4)
5. Click "Deploy"

### C. Automatic Deployments

Once connected to GitHub:
- Every push to `main` → Production deployment
- Every PR → Preview deployment

---

## Step 7: Test Your Deployment

### A. Get Your Vercel URL

After deployment, you'll get a URL like:
```
https://gsl-crm.vercel.app
```

### B. Test Endpoints

```bash
# Health check
curl https://gsl-crm.vercel.app/health

# Database test
curl https://gsl-crm.vercel.app/db-test

# API endpoint (with auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://gsl-crm.vercel.app/api/mysql/users
```

---

## Step 8: Update Frontend to Use Vercel API

### A. Create API Client

Create `src/lib/mysqlClient.ts`:

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_MYSQL_API_URL || 'http://localhost:3001';

export const mysqlApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
mysqlApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default mysqlApi;
```

### B. Add Environment Variable

In your `.env`:

```env
VITE_MYSQL_API_URL=https://gsl-crm.vercel.app
```

### C. Update Components to Use MySQL API

Example - Fetching leads:

```typescript
// Before (Supabase)
const { data } = await supabase.from('leads').select('*');

// After (MySQL API)
const { data } = await mysqlApi.get('/api/mysql/leads');
```

---

## Step 9: Handle CORS

Update `api/mysql/server.ts` to allow your frontend domain:

```typescript
import cors from 'cors';

const allowedOrigins = [
  'http://localhost:5173',
  'https://gsl-crm.vercel.app',
  'https://your-frontend-domain.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

---

## Step 10: Implement Authentication

You'll need to implement JWT authentication. Here's a basic setup:

### A. Install JWT Package

```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

### B. Create Auth Route

Create `api/mysql/routes/auth.ts`:

```typescript
import express from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../../mysql/config/database';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user from database
    const user = await queryOne(
      'SELECT * FROM dashboard_users WHERE email = ? AND status = "Active"',
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // TODO: Verify password (implement password hashing)
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ 
      token, 
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
```

### C. Update Auth Middleware

Update `api/mysql/middleware/auth.ts` to properly verify JWT:

```typescript
import jwt from 'jsonwebtoken';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Fetch user from database
    const user = await queryOne(
      'SELECT * FROM dashboard_users WHERE id = ? AND status = "Active"',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branch_id,
      permissions: JSON.parse(user.permissions || '[]'),
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

---

## 📊 Cost Estimate

### Free Tier Setup
- **Vercel:** Free (Hobby plan)
- **PlanetScale:** Free (5GB storage, 1 billion row reads/month)
- **Total:** $0/month

### Production Setup
- **Vercel:** Free or $20/month (Pro)
- **PlanetScale:** $29/month (Scaler plan)
- **Total:** $29-49/month

---

## 🔍 Monitoring & Debugging

### Vercel Logs

View logs in Vercel dashboard:
1. Go to your project
2. Click "Deployments"
3. Click on a deployment
4. View "Functions" tab for logs

### Database Monitoring

PlanetScale provides:
- Query insights
- Performance metrics
- Connection monitoring

---

## ✅ Deployment Checklist

- [ ] MySQL database created and schema imported
- [ ] Environment variables configured in Vercel
- [ ] `vercel.json` created
- [ ] Server adapted for serverless
- [ ] CORS configured for production
- [ ] JWT authentication implemented
- [ ] Frontend updated to use Vercel API
- [ ] Deployed to Vercel
- [ ] All endpoints tested
- [ ] Error handling verified
- [ ] Monitoring set up

---

## 🚨 Common Issues & Solutions

### Issue: "Cannot connect to database"

**Solution:**
- Check environment variables in Vercel
- Verify database credentials
- Ensure SSL is configured for PlanetScale
- Check database is accessible from Vercel's IP ranges

### Issue: "Function timeout"

**Solution:**
- Vercel free tier has 10s timeout
- Optimize database queries
- Add indexes to frequently queried columns
- Consider upgrading to Pro plan (60s timeout)

### Issue: "CORS errors"

**Solution:**
- Update CORS configuration in `server.ts`
- Add your frontend domain to allowed origins
- Ensure credentials are properly configured

### Issue: "Cold starts are slow"

**Solution:**
- This is normal for serverless
- First request after inactivity takes longer
- Consider keeping functions warm with periodic pings
- Or upgrade to Vercel Pro for better performance

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [PlanetScale Documentation](https://planetscale.com/docs)
- [Deploying Express to Vercel](https://vercel.com/guides/using-express-with-vercel)

---

## 🎉 Next Steps

After deployment:

1. Test all API endpoints thoroughly
2. Monitor performance and errors
3. Set up database backups
4. Configure custom domain (optional)
5. Set up CI/CD for automated testing
6. Implement rate limiting
7. Add API documentation (Swagger/OpenAPI)

Your MySQL API is now live on Vercel! 🚀
