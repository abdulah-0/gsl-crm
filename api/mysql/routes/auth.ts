import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../../mysql/config/database';

const router = express.Router();

/**
 * POST /api/mysql/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Get user from database
        const user = await queryOne<any>(
            `SELECT id, full_name, email, role, status, permissions, branch_id
       FROM dashboard_users
       WHERE email = ? AND status = 'Active'`,
            [email]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // TODO: Implement password hashing and verification
        // For now, this is a placeholder - you should use bcrypt or similar
        // const isValidPassword = await bcrypt.compare(password, user.password_hash);
        // if (!isValidPassword) {
        //   return res.status(401).json({ error: 'Invalid credentials' });
        // }

        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                branchId: user.branch_id
            },
            jwtSecret,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.full_name,
                role: user.role,
                branchId: user.branch_id,
                permissions: JSON.parse(user.permissions || '[]')
            }
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/mysql/auth/verify
 * Verify JWT token
 */
router.post('/verify', async (req: Request, res: Response) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Verify token
        const decoded = jwt.verify(token, jwtSecret) as any;

        // Get fresh user data
        const user = await queryOne<any>(
            `SELECT id, full_name, email, role, status, permissions, branch_id
       FROM dashboard_users
       WHERE id = ? AND status = 'Active'`,
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        res.json({
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.full_name,
                role: user.role,
                branchId: user.branch_id,
                permissions: JSON.parse(user.permissions || '[]')
            }
        });
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        res.status(500).json({ error: 'Token verification failed' });
    }
});

/**
 * POST /api/mysql/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Verify and decode token (ignore expiration)
        const decoded = jwt.verify(token, jwtSecret, { ignoreExpiration: true }) as any;

        // Get fresh user data
        const user = await queryOne<any>(
            `SELECT id, email, role, branch_id FROM dashboard_users WHERE id = ? AND status = 'Active'`,
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        // Generate new token
        const newToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                branchId: user.branch_id
            },
            jwtSecret,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({ token: newToken });
    } catch (error: any) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

export default router;
