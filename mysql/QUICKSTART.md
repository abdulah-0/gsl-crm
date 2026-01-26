# MySQL Migration - Quick Start Guide

This guide will help you quickly set up and test the MySQL migration system.

## 🎯 Overview

The MySQL migration system allows you to migrate your GSL CRM from Supabase to MySQL. It's designed to coexist with your current Supabase setup, so you can test it without affecting your production system.

## ⚡ Quick Setup (5 minutes)

### Step 1: Install MySQL

**Option A: Local MySQL (Recommended for testing)**

**Windows:**
1. Download MySQL Installer from [mysql.com](https://dev.mysql.com/downloads/installer/)
2. Run installer and select "Developer Default"
3. Set root password during installation
4. Complete installation

**Mac:**
```bash
brew install mysql
brew services start mysql
mysql_secure_installation
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

**Option B: Cloud MySQL (Recommended for production)**
- AWS RDS
- DigitalOcean Managed Database
- PlanetScale
- Google Cloud SQL

### Step 2: Install Node Dependencies

```bash
npm install mysql2 bcrypt jsonwebtoken express tsx
npm install --save-dev @types/bcrypt @types/jsonwebtoken @types/express
```

### Step 3: Configure Environment

1. Copy the environment template:
   ```bash
   copy .env.mysql.example .env.mysql
   ```

2. Edit `.env.mysql` and set your MySQL credentials:
   ```env
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_DATABASE=gsl_crm
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   JWT_SECRET=your-secret-key-here
   ```

3. Generate a secure JWT secret:
   ```bash
   # On Windows (PowerShell)
   [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))
   
   # On Mac/Linux
   openssl rand -base64 64
   ```

### Step 4: Create Database

```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE gsl_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

### Step 5: Run Schema Migration

```bash
# Load environment variables
set -a; source .env.mysql; set +a  # Mac/Linux
# OR
Get-Content .env.mysql | ForEach-Object { $var = $_.Split('='); [Environment]::SetEnvironmentVariable($var[0], $var[1]) }  # Windows PowerShell

# Run schema
mysql -u root -p gsl_crm < mysql/schema/schema.sql
```

### Step 6: Test Connection

```bash
npm run mysql:test-connection
```

You should see: ✅ MySQL connection successful

## 📊 Data Migration (Optional)

If you want to migrate existing data from Supabase:

### Step 1: Export from Supabase

```bash
npm run mysql:export
```

This creates JSON files in `mysql/data/`

### Step 2: Import to MySQL

```bash
npm run mysql:import
```

This imports all data into MySQL

### Step 3: Verify Migration

Check record counts:
```bash
mysql -u root -p gsl_crm -e "SELECT 
  (SELECT COUNT(*) FROM dashboard_users) as users,
  (SELECT COUNT(*) FROM leads) as leads,
  (SELECT COUNT(*) FROM universities) as universities,
  (SELECT COUNT(*) FROM dashboard_cases) as cases;"
```

## 🧪 Testing the API

### Create a Test User

```bash
mysql -u root -p gsl_crm
```

```sql
-- Create a test user
INSERT INTO dashboard_users (id, full_name, email, role, status, permissions)
VALUES ('test001', 'Test Admin', 'admin@test.com', 'Super Admin', 'Active', '["dashboard","users","leads","universities"]');

-- Create auth credentials (password: admin123)
INSERT INTO user_auth (email, password_hash, salt, is_verified)
VALUES ('admin@test.com', '$2b$10$YourHashHere', 'salt', 1);
```

### Start API Server

Create `api/mysql/server.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import usersRouter from './routes/users';
import leadsRouter from './routes/leads';
import universitiesRouter from './routes/universities';

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/mysql/users', usersRouter);
app.use('/api/mysql/leads', leadsRouter);
app.use('/api/mysql/universities', universitiesRouter);

app.listen(PORT, () => {
  console.log(`🚀 MySQL API server running on http://localhost:${PORT}`);
});
```

Run:
```bash
npx tsx api/mysql/server.ts
```

### Test API Endpoints

```bash
# Login
curl -X POST http://localhost:3000/api/mysql/users/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'

# Get users (use token from login)
curl http://localhost:3000/api/mysql/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔄 Switching Between Supabase and MySQL

### Option 1: Environment Variable

Set `APP_DATABASE_MODE` in `.env`:
```env
APP_DATABASE_MODE=mysql  # or 'supabase'
```

### Option 2: Separate Builds

Build two versions:
```bash
# Supabase version
npm run build

# MySQL version
APP_DATABASE_MODE=mysql npm run build
```

## 📝 Next Steps

1. **Review the API routes** in `api/mysql/routes/`
2. **Add more routes** for other entities (cases, tasks, etc.)
3. **Update frontend** to use MySQL API
4. **Test thoroughly** before production
5. **Set up proper hosting** for MySQL and API

## 🐛 Troubleshooting

### Can't connect to MySQL

```bash
# Check if MySQL is running
mysql -u root -p

# Check port
netstat -an | grep 3306

# Reset password
mysql -u root
ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpassword';
```

### Import fails with foreign key errors

```bash
# Disable foreign key checks temporarily
mysql -u root -p gsl_crm -e "SET FOREIGN_KEY_CHECKS=0;"
npm run mysql:import
mysql -u root -p gsl_crm -e "SET FOREIGN_KEY_CHECKS=1;"
```

### Token errors

- Make sure JWT_SECRET is set
- Check token hasn't expired
- Verify Authorization header format: `Bearer <token>`

## 📚 Additional Resources

- [Full Documentation](mysql/README.md)
- [API Routes Documentation](api/mysql/README.md)
- [Schema Documentation](mysql/schema/schema.sql)

## 💡 Tips

1. **Start small**: Test with a few records first
2. **Backup everything**: Always backup before migration
3. **Test locally**: Fully test before deploying to production
4. **Monitor performance**: Compare query speeds
5. **Keep Supabase**: Don't delete Supabase data until fully migrated

---

**Need help?** Check the main README or contact the development team.
