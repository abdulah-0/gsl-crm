# GSL CRM - MySQL Migration System

This directory contains a complete MySQL migration system that can be used to migrate the GSL CRM application from Supabase to MySQL.

## 📁 Directory Structure

```
mysql/
├── config/
│   └── database.ts          # MySQL connection configuration
├── migrations/
│   └── (migration files)    # Individual migration files
├── schema/
│   └── schema.sql           # Complete MySQL schema
├── scripts/
│   ├── export-from-supabase.ts   # Export data from Supabase
│   ├── import-to-mysql.ts        # Import data to MySQL
│   └── validate-migration.ts     # Validate migration
└── data/
    └── (exported JSON files)     # Exported data from Supabase
```

## 🚀 Quick Start

### Prerequisites

1. **MySQL Server** (8.0+ recommended)
   - Local installation, or
   - Cloud service (AWS RDS, DigitalOcean, PlanetScale, etc.)

2. **Node.js** (16+ recommended)

3. **Environment Variables**
   Create a `.env` file in the project root with:
   ```env
   # MySQL Configuration
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_DATABASE=gsl_crm
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password

   # JWT Secret (for authentication)
   JWT_SECRET=your-super-secret-jwt-key-change-in-production

   # Supabase (for data export)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Installation

1. **Install Dependencies**
   ```bash
   npm install mysql2 bcrypt jsonwebtoken express
   npm install --save-dev @types/bcrypt @types/jsonwebtoken @types/express
   ```

2. **Create MySQL Database**
   ```sql
   CREATE DATABASE gsl_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **Run Schema Migration**
   ```bash
   mysql -u root -p gsl_crm < mysql/schema/schema.sql
   ```

## 📊 Data Migration Process

### Step 1: Export Data from Supabase

```bash
npm run mysql:export
```

This will:
- Connect to your Supabase database
- Export all tables to JSON files in `mysql/data/`
- Create a metadata file with export information

### Step 2: Import Data to MySQL

```bash
npm run mysql:import
```

This will:
- Read JSON files from `mysql/data/`
- Convert PostgreSQL data types to MySQL compatible formats
- Import data in correct dependency order
- Handle foreign key constraints
- Create an import log

### Step 3: Validate Migration

```bash
npm run mysql:validate
```

This will:
- Compare record counts between Supabase and MySQL
- Validate data integrity
- Check foreign key relationships
- Generate a validation report

## 🔧 Configuration

### Database Connection

Edit `mysql/config/database.ts` to customize:
- Connection pool size
- Timeout settings
- Timezone handling
- Retry logic

### Authentication

The system uses JWT-based authentication:
- Tokens expire after 7 days (configurable)
- Passwords are hashed using bcrypt
- Sessions are stored in `user_sessions` table

## 🛣️ API Routes

### Authentication

- `POST /api/mysql/users/auth/login` - Login
- `POST /api/mysql/users/auth/register` - Register new user
- `GET /api/mysql/users/auth/me` - Get current user

### Users

- `GET /api/mysql/users` - List all users
- `GET /api/mysql/users/:id` - Get single user
- `POST /api/mysql/users` - Create user
- `PUT /api/mysql/users/:id` - Update user
- `DELETE /api/mysql/users/:id` - Delete user

### Leads

- `GET /api/mysql/leads` - List all leads
- `GET /api/mysql/leads/:id` - Get single lead
- `POST /api/mysql/leads` - Create lead
- `PUT /api/mysql/leads/:id` - Update lead
- `DELETE /api/mysql/leads/:id` - Delete lead
- `POST /api/mysql/leads/:id/documents` - Add document
- `POST /api/mysql/leads/:id/timeline` - Add timeline entry

### Universities

- `GET /api/mysql/universities` - List all universities
- `GET /api/mysql/universities/:id` - Get single university
- `POST /api/mysql/universities` - Create university
- `POST /api/mysql/universities/bulk` - Bulk import
- `PUT /api/mysql/universities/:id` - Update university
- `DELETE /api/mysql/universities/:id` - Delete university

## 🔐 Authentication & Authorization

### Role Hierarchy

1. **Super Admin** - Full access to everything
2. **Admin** - Access to all modules, all branches
3. **Branch Director** - Access to their branch only
4. **Manager** - Limited management access
5. **Counsellor** - Lead and student management
6. **Staff** - Basic access
7. **Teacher** - Teaching-related access
8. **Student** - Student portal access

### Permission System

Two-level permission system:
1. **Module-level**: User has access to a module (e.g., 'leads', 'students')
2. **Operation-level**: User can perform specific operations (add, edit, delete)

### Branch-Level Data Isolation

- Super Admin and Admin can access all branches
- Branch Director can only access their assigned branch
- Data is automatically filtered based on user's branch

## 🔄 Migration from Supabase

### Key Differences

| Feature | Supabase (PostgreSQL) | MySQL |
|---------|----------------------|-------|
| Row Level Security (RLS) | Built-in | API-level middleware |
| Real-time | Built-in | Requires custom implementation |
| Authentication | Built-in | Custom JWT-based |
| Auto-increment | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | `BIGINT AUTO_INCREMENT` |
| JSON | `JSONB` | `JSON` |
| Arrays | `TEXT[]` | `JSON` (array as JSON) |
| Timestamps | `TIMESTAMPTZ` | `TIMESTAMP` |

### Data Type Conversions

The migration scripts automatically handle:
- `TIMESTAMPTZ` → `TIMESTAMP` (UTC)
- `JSONB` → `JSON`
- `TEXT[]` → `JSON` (arrays)
- `BOOLEAN` → `TINYINT(1)`
- `UUID` → `CHAR(36)`

## 📝 Adding New API Routes

1. Create a new file in `api/mysql/routes/`
2. Import required middleware
3. Define routes with authentication and authorization
4. Export the router

Example:
```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireModulePermission } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, requireModulePermission('module_name'), async (req, res) => {
  // Your logic here
});

export default router;
```

## 🧪 Testing

### Test Database Connection

```bash
npm run mysql:test-connection
```

### Test API Endpoints

```bash
npm run mysql:test-api
```

## 🐛 Troubleshooting

### Connection Issues

1. **Check MySQL is running**
   ```bash
   mysql -u root -p
   ```

2. **Verify credentials in `.env`**

3. **Check firewall settings**

### Import Errors

1. **Foreign key constraint failures**
   - Ensure tables are imported in correct order
   - Check that referenced records exist

2. **Data type mismatches**
   - Review conversion logic in `import-to-mysql.ts`
   - Check MySQL column definitions

### Authentication Issues

1. **Invalid token**
   - Check JWT_SECRET is set correctly
   - Verify token hasn't expired

2. **Permission denied**
   - Check user role and permissions
   - Verify module permissions are set correctly

## 📚 Additional Resources

- [MySQL Documentation](https://dev.mysql.com/doc/)
- [Express.js Documentation](https://expressjs.com/)
- [JWT Documentation](https://jwt.io/)

## 🔒 Security Considerations

1. **Change JWT_SECRET** in production
2. **Use HTTPS** for all API requests
3. **Implement rate limiting** on authentication endpoints
4. **Regular security audits** of permissions
5. **Keep dependencies updated**
6. **Use prepared statements** (already implemented)
7. **Validate all user input**
8. **Implement CORS** properly

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review error logs
3. Contact the development team

---

**Note**: This MySQL system is designed to coexist with the current Supabase implementation. You can switch between them by changing the API endpoints in your frontend application.
