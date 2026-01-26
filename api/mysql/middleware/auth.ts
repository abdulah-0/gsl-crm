import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../../mysql/config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface AuthUser {
    email: string;
    id: string;
    role: string;
    branch?: string;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}

// Generate JWT token
export function generateToken(user: AuthUser): string {
    return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT token
export function verifyToken(token: string): AuthUser | null {
    try {
        return jwt.verify(token, JWT_SECRET) as AuthUser;
    } catch (error) {
        return null;
    }
}

// Authentication middleware
export async function authenticate(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);

        if (!decoded) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }

        // Verify user still exists and is active
        const user = await queryOne<any>(
            'SELECT id, email, role, status, branch FROM dashboard_users WHERE email = ?',
            [decoded.email]
        );

        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        if (user.status !== 'Active') {
            res.status(403).json({ error: 'User account is inactive' });
            return;
        }

        // Attach user to request
        req.user = {
            email: user.email,
            id: user.id,
            role: user.role,
            branch: user.branch,
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

// Optional authentication (doesn't fail if no token)
export async function optionalAuth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);

        if (decoded) {
            const user = await queryOne<any>(
                'SELECT id, email, role, status, branch FROM dashboard_users WHERE email = ?',
                [decoded.email]
            );

            if (user && user.status === 'Active') {
                req.user = {
                    email: user.email,
                    id: user.id,
                    role: user.role,
                    branch: user.branch,
                };
            }
        }

        next();
    } catch (error) {
        next();
    }
}

// Login function
export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser } | null> {
    try {
        // Get user with password hash
        const user = await queryOne<any>(
            'SELECT ua.*, du.id, du.role, du.branch FROM user_auth ua JOIN dashboard_users du ON ua.email = du.email WHERE ua.email = ? AND du.status = ?',
            [email.toLowerCase(), 'Active']
        );

        if (!user) {
            return null;
        }

        // Verify password (using bcrypt)
        const bcrypt = require('bcrypt');
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return null;
        }

        // Update last login
        await queryOne(
            'UPDATE user_auth SET last_login = NOW() WHERE email = ?',
            [email]
        );

        // Generate token
        const authUser: AuthUser = {
            email: user.email,
            id: user.id,
            role: user.role,
            branch: user.branch,
        };

        const token = generateToken(authUser);

        // Store session
        const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
        await queryOne(
            'INSERT INTO user_sessions (user_email, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
            [email, tokenHash]
        );

        return { token, user: authUser };
    } catch (error) {
        console.error('Login error:', error);
        return null;
    }
}

// Logout function
export async function logout(token: string): Promise<boolean> {
    try {
        const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
        await queryOne(
            'DELETE FROM user_sessions WHERE token_hash = ?',
            [tokenHash]
        );
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        return false;
    }
}

// Register new user
export async function register(
    email: string,
    password: string,
    fullName: string,
    role: string = 'Staff'
): Promise<{ token: string; user: AuthUser } | null> {
    try {
        const bcrypt = require('bcrypt');
        const crypto = require('crypto');

        // Check if user already exists
        const existing = await queryOne(
            'SELECT email FROM user_auth WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existing) {
            return null;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Generate user ID
        const userId = crypto.randomBytes(16).toString('hex');

        // Create dashboard user
        await queryOne(
            'INSERT INTO dashboard_users (id, full_name, email, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, fullName, email.toLowerCase(), role, 'Active', JSON.stringify(['dashboard'])]
        );

        // Create auth record
        await queryOne(
            'INSERT INTO user_auth (email, password_hash, salt, is_verified) VALUES (?, ?, ?, ?)',
            [email.toLowerCase(), passwordHash, salt, false]
        );

        // Generate token
        const authUser: AuthUser = {
            email: email.toLowerCase(),
            id: userId,
            role: role,
        };

        const token = generateToken(authUser);

        return { token, user: authUser };
    } catch (error) {
        console.error('Registration error:', error);
        return null;
    }
}

export default {
    authenticate,
    optionalAuth,
    generateToken,
    verifyToken,
    login,
    logout,
    register,
};
