import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { testConnection } from '../mysql/config/database';
import { errorHandler } from './middleware/auth';

// Import routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import leadsRoutes from './routes/leads';
import casesRoutes from './routes/cases';
import tasksRoutes from './routes/tasks';
import notificationsRoutes from './routes/notifications';
import universitiesRoutes from './routes/universities';
import branchesRoutes from './routes/branches';

const app: Express = express();
const PORT = process.env.MYSQL_API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'GSL CRM MySQL API',
        timestamp: new Date().toISOString()
    });
});

// Database connection test endpoint
app.get('/db-test', async (req: Request, res: Response) => {
    try {
        const isConnected = await testConnection();
        res.json({
            connected: isConnected,
            message: isConnected ? 'Database connection successful' : 'Database connection failed'
        });
    } catch (error) {
        res.status(500).json({
            connected: false,
            error: 'Database connection test failed'
        });
    }
});

// API Routes
app.use('/api/mysql/auth', authRoutes);
app.use('/api/mysql/users', usersRoutes);
app.use('/api/mysql/leads', leadsRoutes);
app.use('/api/mysql/cases', casesRoutes);
app.use('/api/mysql/tasks', tasksRoutes);
app.use('/api/mysql/notifications', notificationsRoutes);
app.use('/api/mysql/universities', universitiesRoutes);
app.use('/api/mysql/branches', branchesRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Test database connection
        const isConnected = await testConnection();
        if (!isConnected) {
            console.error('❌ Failed to connect to MySQL database');
            console.error('Please check your MySQL configuration in .env file');
            process.exit(1);
        }

        app.listen(PORT, () => {
            console.log('');
            console.log('='.repeat(60));
            console.log('  GSL CRM - MySQL API Server');
            console.log('='.repeat(60));
            console.log(`  🚀 Server running on port ${PORT}`);
            console.log(`  🔗 API Base URL: http://localhost:${PORT}/api/mysql`);
            console.log(`  💚 Health Check: http://localhost:${PORT}/health`);
            console.log(`  🗄️  Database Test: http://localhost:${PORT}/db-test`);
            console.log('='.repeat(60));
            console.log('');
            console.log('Available endpoints:');
            console.log('  - /api/mysql/users');
            console.log('  - /api/mysql/leads');
            console.log('  - /api/mysql/cases');
            console.log('  - /api/mysql/tasks');
            console.log('  - /api/mysql/notifications');
            console.log('  - /api/mysql/universities');
            console.log('  - /api/mysql/branches');
            console.log('');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

// Start the server
if (require.main === module) {
    startServer();
}

export default app;
