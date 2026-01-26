import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { query, queryOne } from '../../mysql/config/database';

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY: Record<string, number> = {
    'Super Admin': 100,
    'Admin': 80,
    'Branch Director': 70,
    'Manager': 60,
    'Counsellor': 50,
    'Staff': 40,
    'Teacher': 30,
    'Student': 10,
};

// Check if user has required role
export function requireRole(...allowedRoles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const userRole = req.user.role;
        const hasRole = allowedRoles.some(role => {
            const userLevel = ROLE_HIERARCHY[userRole] || 0;
            const requiredLevel = ROLE_HIERARCHY[role] || 0;
            return userLevel >= requiredLevel;
        });

        if (!hasRole) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        next();
    };
}

// Check if user has permission for a specific module
export function requireModulePermission(module: string, operation?: 'add' | 'edit' | 'delete') {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        // Super Admin has all permissions
        if (req.user.role === 'Super Admin') {
            next();
            return;
        }

        try {
            // Check user permissions
            const userPermissions = await queryOne<any>(
                'SELECT permissions FROM dashboard_users WHERE email = ?',
                [req.user.email]
            );

            if (!userPermissions) {
                res.status(403).json({ error: 'User not found' });
                return;
            }

            const permissions = JSON.parse(userPermissions.permissions || '[]');

            // Check if module is in permissions array
            if (!permissions.includes(module)) {
                res.status(403).json({ error: `No access to ${module} module` });
                return;
            }

            // If specific operation is required, check granular permissions
            if (operation) {
                const modulePerms = await queryOne<any>(
                    'SELECT * FROM user_permissions WHERE user_email = ? AND module = ?',
                    [req.user.email, module]
                );

                if (!modulePerms || !modulePerms.access) {
                    res.status(403).json({ error: `No access to ${module} module` });
                    return;
                }

                const operationField = `can_${operation}`;
                if (!modulePerms[operationField]) {
                    res.status(403).json({ error: `Cannot ${operation} in ${module} module` });
                    return;
                }
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'Permission check failed' });
        }
    };
}

// Check if user can access specific branch data
export async function checkBranchAccess(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    // Super Admin and Admin can access all branches
    if (req.user.role === 'Super Admin' || req.user.role === 'Admin') {
        next();
        return;
    }

    // Branch Director can only access their branch
    if (req.user.role === 'Branch Director') {
        const requestedBranch = req.query.branch || req.body.branch;

        if (requestedBranch && requestedBranch !== req.user.branch) {
            res.status(403).json({ error: 'Cannot access data from other branches' });
            return;
        }

        // Add branch filter to query
        req.query.branch = req.user.branch;
    }

    next();
}

// Check if user can modify specific resource
export async function checkResourceOwnership(
    resourceType: string,
    resourceIdParam: string = 'id'
) {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        // Super Admin can modify anything
        if (req.user.role === 'Super Admin') {
            next();
            return;
        }

        try {
            const resourceId = req.params[resourceIdParam];

            // Check resource ownership based on type
            let ownershipQuery = '';
            let params: any[] = [resourceId];

            switch (resourceType) {
                case 'lead':
                    ownershipQuery = 'SELECT assigned_to_email FROM leads WHERE id = ?';
                    break;
                case 'case':
                    ownershipQuery = 'SELECT employee FROM dashboard_cases WHERE id = ?';
                    break;
                case 'task':
                    ownershipQuery = 'SELECT assigned_to_email, created_by_email FROM dashboard_tasks WHERE id = ?';
                    break;
                default:
                    next();
                    return;
            }

            const resource = await queryOne<any>(ownershipQuery, params);

            if (!resource) {
                res.status(404).json({ error: 'Resource not found' });
                return;
            }

            // Check if user is owner or assigned
            const isOwner =
                resource.assigned_to_email === req.user.email ||
                resource.created_by_email === req.user.email ||
                resource.employee === req.user.email;

            if (!isOwner && req.user.role !== 'Admin') {
                res.status(403).json({ error: 'Cannot modify this resource' });
                return;
            }

            next();
        } catch (error) {
            console.error('Ownership check error:', error);
            res.status(500).json({ error: 'Ownership check failed' });
        }
    };
}

// Apply branch filter to query based on user role
export function applyBranchFilter(userEmail: string, userRole: string, userBranch?: string): string {
    if (userRole === 'Super Admin' || userRole === 'Admin') {
        return ''; // No filter for Super Admin/Admin
    }

    if (userRole === 'Branch Director' && userBranch) {
        return ` AND branch = '${userBranch}'`;
    }

    return '';
}

// Get user's accessible branches
export async function getUserBranches(userEmail: string, userRole: string): Promise<string[]> {
    if (userRole === 'Super Admin' || userRole === 'Admin') {
        const branches = await query<any>('SELECT name FROM branches WHERE status = ?', ['Active']);
        return branches.map(b => b.name);
    }

    const user = await queryOne<any>(
        'SELECT branch FROM dashboard_users WHERE email = ?',
        [userEmail]
    );

    return user && user.branch ? [user.branch] : [];
}

export default {
    requireRole,
    requireModulePermission,
    checkBranchAccess,
    checkResourceOwnership,
    applyBranchFilter,
    getUserBranches,
};
