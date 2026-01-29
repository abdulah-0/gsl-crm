# Quick Deployment Steps for Vercel

This is a condensed version of the full deployment guide. For detailed instructions, see [VERCEL_DEPLOYMENT.md](file:///c:/Users/snake/OneDrive/Desktop/gsl-crm-main/mysql/VERCEL_DEPLOYMENT.md).

## Prerequisites

- ✅ MySQL migration system is already set up
- ✅ Vercel configuration created
- ✅ JWT authentication implemented
- ✅ All dependencies added to package.json

## Step-by-Step Deployment

### 1. Set Up MySQL Database (15-20 minutes)

**Recommended: PlanetScale (Free Tier Available)**

1. Go to [planetscale.com](https://planetscale.com) and sign up
2. Create a new database named `gsl-crm`
3. Get connection details from the "Connect" tab
4. Import schema:
   ```bash
   # Using PlanetScale CLI
   pscale shell gsl-crm main < mysql/schema/complete_schema.sql
   
   # Or using MySQL client
   mysql -h aws.connect.psdb.cloud -u your_username -p your_database < mysql/schema/complete_schema.sql
   ```

### 2. Install Dependencies (2 minutes)

```bash
npm install
```

This installs all required packages including:
- `mysql2` - MySQL client
- `express` - API framework
- `jsonwebtoken` - JWT authentication
- `cors` - CORS middleware

### 3. Deploy to Vercel (5 minutes)

**Option A: Using Vercel Dashboard (Recommended)**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project:
   - Framework: Other
   - Root Directory: ./
   - Build Command: `npm run build`
4. Add environment variables (see below)
5. Click "Deploy"

**Option B: Using Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 4. Configure Environment Variables in Vercel

Go to Project Settings → Environment Variables and add:

```env
# MySQL Database
MYSQL_HOST=aws.connect.psdb.cloud
MYSQL_PORT=3306
MYSQL_USER=your_planetscale_username
MYSQL_PASSWORD=your_planetscale_password
MYSQL_DATABASE=gsl-crm
MYSQL_SSL=true

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRES_IN=7d

# Node Environment
NODE_ENV=production
```

**Important:** 
- Generate a strong JWT_SECRET (at least 32 characters)
- Keep these values secret!

### 5. Test Your Deployment (5 minutes)

After deployment, test these endpoints:

```bash
# Replace with your Vercel URL
VERCEL_URL="https://your-app.vercel.app"

# Health check
curl $VERCEL_URL/health

# Database test
curl $VERCEL_URL/db-test

# Login (create a test user first)
curl -X POST $VERCEL_URL/api/mysql/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gslcrm.com","password":"test123"}'
```

### 6. Update Frontend (10 minutes)

Add to your `.env`:

```env
VITE_MYSQL_API_URL=https://your-app.vercel.app
```

Create API client in `src/lib/mysqlClient.ts`:

```typescript
import axios from 'axios';

const mysqlApi = axios.create({
  baseURL: import.meta.env.VITE_MYSQL_API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token
mysqlApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default mysqlApi;
```

## Troubleshooting

### "Cannot connect to database"
- Check environment variables in Vercel
- Verify MySQL credentials
- Ensure `MYSQL_SSL=true` for PlanetScale

### "Function timeout"
- Free tier has 10s timeout
- Optimize queries or upgrade to Pro ($20/month for 60s timeout)

### "CORS errors"
- Update CORS config in `api/mysql/server.ts`
- Add your frontend domain to allowed origins

## Cost Estimate

**Free Tier:**
- Vercel: Free (Hobby plan)
- PlanetScale: Free (5GB storage)
- **Total: $0/month**

**Production:**
- Vercel: $20/month (Pro plan, optional)
- PlanetScale: $29/month (Scaler plan)
- **Total: $29-49/month**

## Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Verify authentication works
3. ✅ Test frontend integration
4. 📝 Set up monitoring (Vercel Analytics)
5. 📝 Configure custom domain (optional)
6. 📝 Set up database backups
7. 📝 Implement rate limiting

## Important Notes

- The TypeScript errors you see are normal - they'll resolve after running `npm install`
- The MySQL API runs separately from your frontend
- You can keep using Supabase while testing MySQL
- No changes to your current Supabase setup are required

## Support

For detailed instructions and troubleshooting, see:
- [Full Deployment Guide](file:///c:/Users/snake/OneDrive/Desktop/gsl-crm-main/mysql/VERCEL_DEPLOYMENT.md)
- [MySQL README](file:///c:/Users/snake/OneDrive/Desktop/gsl-crm-main/mysql/README.md)
- [Setup Guide](file:///c:/Users/snake/OneDrive/Desktop/gsl-crm-main/mysql/SETUP_GUIDE.md)

---

**Total Time Estimate:** 30-45 minutes for complete deployment
