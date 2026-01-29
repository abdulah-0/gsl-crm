# GSL CRM - MySQL Migration System

This folder contains a complete MySQL migration system that can coexist with the current Supabase implementation. It provides a future-proof path to migrate from Supabase to MySQL when needed.

## 📁 Folder Structure

```
mysql/
├── config/
│   └── database.ts          # MySQL connection configuration
├── schema/
│   └── complete_schema.sql  # Complete MySQL database schema
├── migrations/              # Migration scripts
├── scripts/                 # Utility scripts
└── data/                    # Sample/seed data

api/mysql/
├── middleware/
│   └── auth.ts             # Authentication & authorization middleware
├── routes/
│   ├── users.ts            # User management routes
│   ├── leads.ts            # Lead management routes
│   ├── cases.ts            # Case management routes
│   ├── tasks.ts            # Task management routes
│   ├── notifications.ts    # Notification routes
│   ├── universities.ts     # University routes
│   └── branches.ts         # Branch management routes
├── utils/
│   └── dbHelpers.ts        # Database utility functions
└── server.ts               # Main API server
```

## 🚀 Quick Start

### 1. Install MySQL

Download and install MySQL 8.0+ from [mysql.com](https://dev.mysql.com/downloads/)

### 2. Configure Environment Variables

Copy the example environment file and configure your MySQL connection:

```bash
cp mysql/.env.example mysql/.env
```

Edit `mysql/.env` with your MySQL credentials:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=gsl_crm
MYSQL_API_PORT=3001
```

### 3. Create Database and Schema

Run the schema creation script:

```bash
mysql -u root -p < mysql/schema/complete_schema.sql
```

Or use a MySQL client:

```sql
SOURCE mysql/schema/complete_schema.sql;
```

### 4. Install Dependencies

Install required npm packages:

```bash
npm install mysql2 express cors
npm install --save-dev @types/express @types/cors
```

### 5. Start the MySQL API Server

```bash
npm run mysql:dev
```

Or manually:

```bash
ts-node api/mysql/server.ts
```

The API server will start on `http://localhost:3001`

## 📚 API Documentation

### Base URL

```
http://localhost:3001/api/mysql
```

### Authentication

All API endpoints (except `/health` and `/db-test`) require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Available Endpoints

#### Users
- `GET /api/mysql/users` - Get all users (paginated)
- `GET /api/mysql/users/:id` - Get user by ID
- `GET /api/mysql/users/email/:email` - Get user by email
- `POST /api/mysql/users` - Create new user
- `PUT /api/mysql/users/:id` - Update user
- `DELETE /api/mysql/users/:id` - Delete user

#### Leads
- `GET /api/mysql/leads` - Get all leads (paginated)
- `GET /api/mysql/leads/:id` - Get lead by ID
- `POST /api/mysql/leads` - Create new lead
- `PUT /api/mysql/leads/:id` - Update lead
- `DELETE /api/mysql/leads/:id` - Delete lead
- `POST /api/mysql/leads/:id/convert` - Convert lead to student/case
- `GET /api/mysql/leads/stats/summary` - Get lead statistics

#### Cases
- `GET /api/mysql/cases` - Get all cases (paginated)
- `GET /api/mysql/cases/:id` - Get case by ID
- `POST /api/mysql/cases` - Create new case
- `PUT /api/mysql/cases/:id` - Update case
- `DELETE /api/mysql/cases/:id` - Delete case
- `GET /api/mysql/cases/:id/history` - Get application history
- `GET /api/mysql/cases/stats/summary` - Get case statistics

#### Tasks
- `GET /api/mysql/tasks` - Get all tasks (paginated)
- `GET /api/mysql/tasks/my-tasks` - Get current user's tasks
- `GET /api/mysql/tasks/:id` - Get task by ID
- `POST /api/mysql/tasks` - Create new task
- `PUT /api/mysql/tasks/:id` - Update task
- `DELETE /api/mysql/tasks/:id` - Delete task
- `GET /api/mysql/tasks/stats/summary` - Get task statistics

#### Notifications
- `GET /api/mysql/notifications` - Get user's notifications
- `GET /api/mysql/notifications/unread-count` - Get unread count
- `GET /api/mysql/notifications/:id` - Get notification by ID
- `PUT /api/mysql/notifications/:id/read` - Mark as read
- `PUT /api/mysql/notifications/mark-all-read` - Mark all as read
- `DELETE /api/mysql/notifications/:id` - Delete notification
- `DELETE /api/mysql/notifications/clear-all` - Clear all read notifications

#### Universities
- `GET /api/mysql/universities` - Get all universities (paginated)
- `GET /api/mysql/universities/:id` - Get university by ID
- `POST /api/mysql/universities` - Create new university
- `PUT /api/mysql/universities/:id` - Update university
- `DELETE /api/mysql/universities/:id` - Delete university
- `GET /api/mysql/universities/countries/list` - Get list of countries

#### Branches
- `GET /api/mysql/branches` - Get all branches (paginated)
- `GET /api/mysql/branches/:id` - Get branch by ID
- `POST /api/mysql/branches` - Create new branch
- `PUT /api/mysql/branches/:id` - Update branch
- `DELETE /api/mysql/branches/:id` - Delete branch

### Query Parameters

Most GET endpoints support the following query parameters:

- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20)
- `search` - Search term
- `status` - Filter by status
- `branchId` - Filter by branch (Super Admin only)

Example:
```
GET /api/mysql/leads?page=1&pageSize=20&status=New&search=john
```

## 🔐 Security Features

### Role-Based Access Control (RBAC)

The system implements role-based access control with the following roles:

- **Super Admin** - Full access to all data and branches
- **Admin** - Access to their branch data
- **Counsellor** - Limited access based on permissions
- **Staff** - Limited access based on permissions

### Permission-Based Access

Each user has a `permissions` array that defines which features they can access:

```json
["dashboard", "leads", "students", "cases", "tasks", "users"]
```

### Branch-Level Data Isolation

Non-Super Admin users can only access data from their assigned branch. This is enforced at the API level.

## 🔄 Migration from Supabase

When you're ready to migrate from Supabase to MySQL:

### 1. Export Data from Supabase

Use the provided export script:

```bash
npm run export:supabase
```

### 2. Import Data to MySQL

```bash
npm run import:mysql
```

### 3. Update Frontend Configuration

Update your frontend to use the MySQL API instead of Supabase:

```typescript
// Before (Supabase)
import { supabase } from './lib/supabaseClient';
const { data } = await supabase.from('leads').select('*');

// After (MySQL API)
import axios from 'axios';
const { data } = await axios.get('http://localhost:3001/api/mysql/leads');
```

### 4. Switch Authentication

Update authentication to use JWT tokens instead of Supabase Auth.

## 📊 Database Schema

The MySQL schema includes the following main tables:

- `dashboard_users` - Application users with RBAC
- `branches` - Branch/office locations
- `leads` - Lead management
- `dashboard_students` - Student records
- `dashboard_cases` - Application cases
- `universities` - University catalog
- `dashboard_tasks` - Task management
- `notifications` - User notifications
- `leaves` - Leave management
- `time_records` - Attendance tracking
- `payroll` - Payroll management
- `invoices` - Invoice management
- `payments` - Payment tracking

See `mysql/schema/complete_schema.sql` for the complete schema definition.

## 🛠️ Development

### Adding New Routes

1. Create a new route file in `api/mysql/routes/`
2. Import and use in `api/mysql/server.ts`
3. Add authentication and authorization middleware
4. Implement CRUD operations using `TableOperations` class

Example:

```typescript
import express from 'express';
import { TableOperations } from '../utils/dbHelpers';
import { authenticate, requirePermission } from '../middleware/auth';

const router = express.Router();
const myTable = new TableOperations('my_table');

router.use(authenticate);

router.get('/', requirePermission('my_feature'), async (req, res) => {
  const data = await myTable.getAll();
  res.json(data);
});

export default router;
```

### Database Utilities

The `dbHelpers.ts` file provides useful utilities:

- `TableOperations` - Generic CRUD operations
- `paginate()` - Pagination helper
- `search()` - Full-text search
- `batchInsert()` - Bulk insert
- `generateId()` - ID generation

## 🧪 Testing

Test the database connection:

```bash
curl http://localhost:3001/db-test
```

Test an API endpoint:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/mysql/users
```

## 📝 Notes

- This system is designed to coexist with Supabase
- No changes to the current Supabase implementation are required
- You can test and develop the MySQL system independently
- When ready to migrate, simply switch the frontend to use the MySQL API

## 🆘 Troubleshooting

### Connection Issues

If you can't connect to MySQL:

1. Check MySQL is running: `mysql -u root -p`
2. Verify credentials in `mysql/.env`
3. Check firewall settings
4. Ensure MySQL port 3306 is not blocked

### Schema Issues

If schema creation fails:

1. Drop and recreate database: `DROP DATABASE IF EXISTS gsl_crm; CREATE DATABASE gsl_crm;`
2. Run schema script again
3. Check MySQL error logs

### API Issues

If API endpoints return errors:

1. Check server logs
2. Verify authentication token
3. Check user permissions
4. Verify branch access

## 📞 Support

For issues or questions, please refer to the main project documentation or contact the development team.
