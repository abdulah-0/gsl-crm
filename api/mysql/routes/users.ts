import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest, login as authLogin, register as authRegister } from '../middleware/auth';
import { requireRole, requireModulePermission } from '../middleware/rbac';
import { query, queryOne, insert, execute, buildInsert, buildUpdate, transaction } from '../../mysql/config/database';

const router = Router();

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

// Login
router.post('/auth/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        const result = await authLogin(email, password);

        if (!result) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        res.json(result);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register
router.post('/auth/register', async (req: Request, res: Response) => {
    try {
        const { email, password, fullName, role } = req.body;

        if (!email || !password || !fullName) {
            res.status(400).json({ error: 'Email, password, and full name are required' });
            return;
        }

        const result = await authRegister(email, password, fullName, role);

        if (!result) {
            res.status(400).json({ error: 'User already exists or registration failed' });
            return;
        }

        res.json(result);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Get current user
router.get('/auth/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const user = await queryOne(
            'SELECT id, full_name, email, role, status, permissions, branch FROM dashboard_users WHERE email = ?',
            [req.user!.email]
        );

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ============================================================================
// USERS CRUD
// ============================================================================

// List all users
router.get('/', authenticate, requireModulePermission('users'), async (req: AuthRequest, res: Response) => {
    try {
        const { role, status, branch, search } = req.query;

        let sql = 'SELECT id, full_name, email, role, status, permissions, branch, created_at, updated_at FROM dashboard_users WHERE 1=1';
        const params: any[] = [];

        if (role) {
            sql += ' AND role = ?';
            params.push(role);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (branch) {
            sql += ' AND branch = ?';
            params.push(branch);
        }

        if (search) {
            sql += ' AND (full_name LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY created_at DESC';

        const users = await query(sql, params);
        res.json(users);
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// Get single user
router.get('/:id', authenticate, requireModulePermission('users'), async (req: AuthRequest, res: Response) => {
    try {
        const user = await queryOne(
            'SELECT id, full_name, email, role, status, permissions, branch, created_at, updated_at FROM dashboard_users WHERE id = ?',
            [req.params.id]
        );

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Get user permissions
        const permissions = await query(
            'SELECT module, access, can_add, can_edit, can_delete FROM user_permissions WHERE user_email = ?',
            [user.email]
        );

        // Get reporting hierarchy
        const reportsTo = await query(
            'SELECT reports_to_email FROM user_reporting_hierarchy WHERE user_email = ?',
            [user.email]
        );

        res.json({
            ...user,
            modulePermissions: permissions,
            reportsTo: reportsTo.map(r => r.reports_to_email),
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Create user
router.post('/', authenticate, requireRole('Admin'), requireModulePermission('users', 'add'), async (req: AuthRequest, res: Response) => {
    try {
        const { id, full_name, email, role, status, permissions, branch, modulePermissions, reportsTo } = req.body;

        if (!id || !full_name || !email || !role) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        await transaction(async (conn) => {
            // Insert user
            const { sql, params } = buildInsert('dashboard_users', {
                id,
                full_name,
                email: email.toLowerCase(),
                role,
                status: status || 'Active',
                permissions: JSON.stringify(permissions || ['dashboard']),
                branch: branch || null,
            });

            await conn.execute(sql, params);

            // Insert module permissions
            if (modulePermissions && Array.isArray(modulePermissions)) {
                for (const perm of modulePermissions) {
                    await conn.execute(
                        'INSERT INTO user_permissions (user_email, module, access, can_add, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)',
                        [email.toLowerCase(), perm.module, perm.access, perm.can_add, perm.can_edit, perm.can_delete]
                    );
                }
            }

            // Insert reporting hierarchy
            if (reportsTo && Array.isArray(reportsTo)) {
                for (const manager of reportsTo) {
                    await conn.execute(
                        'INSERT INTO user_reporting_hierarchy (user_email, reports_to_email) VALUES (?, ?)',
                        [email.toLowerCase(), manager]
                    );
                }
            }
        });

        res.status(201).json({ message: 'User created successfully', id });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
router.put('/:id', authenticate, requireRole('Admin'), requireModulePermission('users', 'edit'), async (req: AuthRequest, res: Response) => {
    try {
        const { full_name, email, role, status, permissions, branch, modulePermissions, reportsTo } = req.body;

        const existing = await queryOne('SELECT email FROM dashboard_users WHERE id = ?', [req.params.id]);
        if (!existing) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        await transaction(async (conn) => {
            // Update user
            const updateData: any = {};
            if (full_name) updateData.full_name = full_name;
            if (email) updateData.email = email.toLowerCase();
            if (role) updateData.role = role;
            if (status) updateData.status = status;
            if (permissions) updateData.permissions = JSON.stringify(permissions);
            if (branch !== undefined) updateData.branch = branch;

            if (Object.keys(updateData).length > 0) {
                const { sql, params } = buildUpdate('dashboard_users', updateData, { id: req.params.id });
                await conn.execute(sql, params);
            }

            const finalEmail = email?.toLowerCase() || existing.email;

            // Update module permissions
            if (modulePermissions) {
                await conn.execute('DELETE FROM user_permissions WHERE user_email = ?', [finalEmail]);

                for (const perm of modulePermissions) {
                    await conn.execute(
                        'INSERT INTO user_permissions (user_email, module, access, can_add, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)',
                        [finalEmail, perm.module, perm.access, perm.can_add, perm.can_edit, perm.can_delete]
                    );
                }
            }

            // Update reporting hierarchy
            if (reportsTo) {
                await conn.execute('DELETE FROM user_reporting_hierarchy WHERE user_email = ?', [finalEmail]);

                for (const manager of reportsTo) {
                    await conn.execute(
                        'INSERT INTO user_reporting_hierarchy (user_email, reports_to_email) VALUES (?, ?)',
                        [finalEmail, manager]
                    );
                }
            }
        });

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/:id', authenticate, requireRole('Super Admin'), requireModulePermission('users', 'delete'), async (req: AuthRequest, res: Response) => {
    try {
        const user = await queryOne('SELECT email FROM dashboard_users WHERE id = ?', [req.params.id]);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        await transaction(async (conn) => {
            await conn.execute('DELETE FROM user_permissions WHERE user_email = ?', [user.email]);
            await conn.execute('DELETE FROM user_reporting_hierarchy WHERE user_email = ?', [user.email]);
            await conn.execute('DELETE FROM dashboard_users WHERE id = ?', [req.params.id]);
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
