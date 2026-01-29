# MySQL Migration System - Quick Setup Guide

This guide will help you set up the MySQL migration system for your GSL CRM application.

## Prerequisites

- Node.js 18+ installed
- MySQL 8.0+ installed and running
- Access to your current Supabase database

## Step-by-Step Setup

### 1. Install MySQL

If you don't have MySQL installed:

**Windows:**
- Download from: https://dev.mysql.com/downloads/installer/
- Run the installer and follow the wizard
- Remember your root password!

**macOS:**
```bash
brew install mysql
brew services start mysql
```

**Linux:**
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
```

### 2. Install Node Dependencies

```bash
npm install
```

This will install all required packages including:
- `mysql2` - MySQL client for Node.js
- `express` - Web framework for API
- `cors` - CORS middleware
- `dotenv` - Environment variable management
- `ts-node` - TypeScript execution

### 3. Configure Environment Variables

Create a `.env` file in the `mysql` folder:

```bash
cp mysql/.env.example mysql/.env
```

Edit `mysql/.env` with your MySQL credentials:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=gsl_crm
MYSQL_API_PORT=3001
```

### 4. Create Database

Open MySQL command line:

```bash
mysql -u root -p
```

Run the setup script:

```sql
SOURCE mysql/scripts/setup_database.sql;
```

### 5. Create Database Schema

```sql
SOURCE mysql/schema/complete_schema.sql;
```

### 6. (Optional) Load Sample Data

For testing purposes, you can load sample data:

```sql
SOURCE mysql/data/sample_data.sql;
```

### 7. Test Database Connection

```bash
npm run mysql:dev
```

Visit: http://localhost:3001/db-test

You should see:
```json
{
  "connected": true,
  "message": "Database connection successful"
}
```

## Testing the API

### 1. Start the API Server

```bash
npm run mysql:dev
```

### 2. Test Endpoints

**Health Check:**
```bash
curl http://localhost:3001/health
```

**Database Test:**
```bash
curl http://localhost:3001/db-test
```

**Get Users (requires auth token):**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/mysql/users
```

## Migrating Data from Supabase

When you're ready to migrate your existing data:

### 1. Ensure Supabase credentials are in `.env`

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### 2. Run Migration Script

```bash
npm run mysql:migrate
```

This will:
- Export all data from Supabase
- Import it into MySQL
- Verify the migration

### 3. Verify Migration

```bash
npm run mysql:verify
```

## Common Issues & Solutions

### Issue: Can't connect to MySQL

**Solution:**
1. Check MySQL is running: `mysql -u root -p`
2. Verify credentials in `mysql/.env`
3. Check firewall settings
4. Ensure port 3306 is not blocked

### Issue: "Access denied for user"

**Solution:**
1. Reset MySQL password:
```bash
mysql -u root -p
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
```
2. Update `mysql/.env` with new password

### Issue: "Database does not exist"

**Solution:**
```bash
mysql -u root -p
CREATE DATABASE gsl_crm;
SOURCE mysql/schema/complete_schema.sql;
```

### Issue: TypeScript errors

**Solution:**
```bash
npm install --save-dev @types/node @types/express @types/cors
```

## Next Steps

1. ✅ Database is set up
2. ✅ API server is running
3. 📝 Implement authentication (JWT)
4. 📝 Update frontend to use MySQL API
5. 📝 Test all features
6. 📝 Deploy to production

## API Documentation

Full API documentation is available in `mysql/README.md`

## Support

For issues or questions:
1. Check `mysql/README.md` for detailed documentation
2. Review error logs in the console
3. Contact the development team

---

**Note:** This MySQL system is designed to coexist with your current Supabase setup. You can test and develop it independently without affecting your production system.
