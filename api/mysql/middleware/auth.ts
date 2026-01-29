import { Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../../mysql/config/database';

// Extend Express Request to include user info
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: string;
                branchId?: number;
                permissions: string[];
            };
        }
    }
}

/**
 * Authentication middleware
 * Verifies the user's session/token and attaches user info to request
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Get auth token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        const token = authHeader.substring(7);

        // Verify and decode JWT token
        const decoded = verifyAndDecodeToken(token);
        if (!decoded || !decoded.id) {
            return res.status(401).json({ error: 'Invalid authentication token' });
        }

        // Fetch user from database
        const user = await queryOne<any>(
            `SELECT id, email, role, branch_id, permissions, status
       FROM dashboard_users
       WHERE id = ? AND status = 'Active'`,
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        // Attach user info to request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            branchId: user.branch_id,
            permissions: JSON.parse(user.permissions || '[]'),
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

/**
 * Authorization middleware - Check if user has required role
 */
export const authorize = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: allowedRoles,
                current: req.user.role
            });
        }

        next();
    };
};

/**
 * Permission-based authorization
 * Check if user has specific permission
 */
export const requirePermission = (...requiredPermissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Super Admin has all permissions
        if (req.user.role === 'Super Admin') {
            return next();
        }

        // Check if user has at least one of the required permissions
        const hasPermission = requiredPermissions.some(permission =>
            req.user!.permissions.includes(permission)
        );

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: requiredPermissions
            });
        }

        next();
    };
};

/**
 * Branch-based data filtering
 * Ensures users can only access data from their branch (except Super Admin)
 */
export const enforceBranchAccess = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    // Super Admin can access all branches
    if (req.user.role === 'Super Admin') {
        return next();
    }

    // Attach branch filter to request for use in queries
    req.query.branchId = req.user.branchId?.toString() || '';

    next();
};

/**
 * Helper function to verify and decode JWT token
 */
function verifyAndDecodeToken(token: string): any {
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET not configured');
        }

        // Use jsonwebtoken library for proper verification
        const jwt = require('jsonwebtoken');
        return jwt.verify(token, jwtSecret);
    } catch (error) {
        return null;
    }
}

/**
 * Error handler middleware
 */
export const errorHandler = (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('API Error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            error: 'Duplicate entry',
            message: 'A record with this value already exists'
        });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
            error: 'Invalid reference',
            message: 'Referenced record does not exist'
        });
    }

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};
