import express, { Request, Response } from 'express';
import { TableOperations, paginate, search } from '../utils/dbHelpers';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = express.Router();
const usersTable = new TableOperations('dashboard_users');

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/mysql/users
 * Get all users with pagination and filtering
 */
router.get('/', requirePermission('users'), async (req: Request, res: Response) => {
    try {
        const { page, pageSize, role, status, branchId, search: searchTerm } = req.query;

        // Build filters
        const filters: Record<string, any> = {};
        if (role) filters.role = role;
        if (status) filters.status = status;

        // Branch filtering for non-Super Admin users
        if (req.user?.role !== 'Super Admin' && req.user?.branchId) {
            filters.branch_id = req.user.branchId;
        } else if (branchId) {
            filters.branch_id = branchId;
        }

        // Search functionality
        if (searchTerm) {
            const results = await search(
                'dashboard_users',
                ['full_name', 'email', 'employee_id'],
                searchTerm as string,
                filters
            );
            return res.json({ data: results });
        }

        // Paginated results
        const result = await paginate('dashboard_users', filters, {
            page: page ? parseInt(page as string) : 1,
            pageSize: pageSize ? parseInt(pageSize as string) : 20,
            orderBy: 'created_at',
            orderDirection: 'DESC'
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * GET /api/mysql/users/:id
 * Get a single user by ID
 */
router.get('/:id', requirePermission('users'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await usersTable.getById(id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && user.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

/**
 * POST /api/mysql/users
 * Create a new user
 */
router.post('/', authorize('Super Admin', 'Admin'), async (req: Request, res: Response) => {
    try {
        const userData = req.body;

        // Validate required fields
        if (!userData.id || !userData.full_name || !userData.email || !userData.role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Set branch_id from current user if not Super Admin
        if (req.user?.role !== 'Super Admin' && !userData.branch_id) {
            userData.branch_id = req.user?.branchId;
        }

        // Set default values
        userData.status = userData.status || 'Active';
        userData.permissions = JSON.stringify(userData.permissions || []);

        const result = await usersTable.create(userData);
        res.status(201).json({
            message: 'User created successfully',
            id: userData.id,
            ...result
        });
    } catch (error: any) {
        console.error('Error creating user:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'User with this ID or email already exists' });
        }

        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * PUT /api/mysql/users/:id
 * Update a user
 */
router.put('/:id', authorize('Super Admin', 'Admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Check if user exists
        const existingUser = await usersTable.getById(id);
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && existingUser.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Don't allow changing ID
        delete updates.id;

        // Stringify permissions if provided
        if (updates.permissions) {
            updates.permissions = JSON.stringify(updates.permissions);
        }

        const result = await usersTable.update(id, updates);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'User updated successfully',
            ...result
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * DELETE /api/mysql/users/:id
 * Delete a user
 */
router.delete('/:id', authorize('Super Admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const existingUser = await usersTable.getById(id);
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const result = await usersTable.delete(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

/**
 * GET /api/mysql/users/email/:email
 * Get user by email
 */
router.get('/email/:email', requirePermission('users'), async (req: Request, res: Response) => {
    try {
        const { email } = req.params;
        const user = await usersTable.getOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && user.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user by email:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

export default router;
