import express, { Request, Response } from 'express';
import { TableOperations, paginate, search } from '../utils/dbHelpers';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = express.Router();
const branchesTable = new TableOperations('branches');

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/mysql/branches
 * Get all branches with pagination and filtering
 */
router.get('/', requirePermission('branches'), async (req: Request, res: Response) => {
    try {
        const { page, pageSize, status, city, search: searchTerm } = req.query;

        // Build filters
        const filters: Record<string, any> = {};
        if (status) filters.status = status;
        if (city) filters.city = city;

        // Non-Super Admin users can only see their own branch
        if (req.user?.role !== 'Super Admin' && req.user?.branchId) {
            filters.id = req.user.branchId;
        }

        // Search functionality
        if (searchTerm) {
            const results = await search(
                'branches',
                ['name', 'code', 'city', 'address'],
                searchTerm as string,
                filters
            );
            return res.json({ data: results });
        }

        // Paginated results
        const result = await paginate('branches', filters, {
            page: page ? parseInt(page as string) : 1,
            pageSize: pageSize ? parseInt(pageSize as string) : 20,
            orderBy: 'name',
            orderDirection: 'ASC'
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

/**
 * GET /api/mysql/branches/:id
 * Get a single branch by ID
 */
router.get('/:id', requirePermission('branches'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const branch = await branchesTable.getById(id);

        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        // Check access
        if (req.user?.role !== 'Super Admin' && branch.id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(branch);
    } catch (error) {
        console.error('Error fetching branch:', error);
        res.status(500).json({ error: 'Failed to fetch branch' });
    }
});

/**
 * POST /api/mysql/branches
 * Create a new branch
 */
router.post('/', authorize('Super Admin'), async (req: Request, res: Response) => {
    try {
        const branchData = req.body;

        // Validate required fields
        if (!branchData.name) {
            return res.status(400).json({ error: 'Missing required field: name' });
        }

        branchData.created_by = req.user?.id;
        branchData.status = branchData.status || 'Active';

        const result = await branchesTable.create(branchData);
        res.status(201).json({
            message: 'Branch created successfully',
            id: result.id,
            ...result
        });
    } catch (error: any) {
        console.error('Error creating branch:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Branch with this code already exists' });
        }

        res.status(500).json({ error: 'Failed to create branch' });
    }
});

/**
 * PUT /api/mysql/branches/:id
 * Update a branch
 */
router.put('/:id', authorize('Super Admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Don't allow changing ID
        delete updates.id;

        const result = await branchesTable.update(id, updates);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        res.json({
            message: 'Branch updated successfully',
            ...result
        });
    } catch (error) {
        console.error('Error updating branch:', error);
        res.status(500).json({ error: 'Failed to update branch' });
    }
});

/**
 * DELETE /api/mysql/branches/:id
 * Delete a branch
 */
router.delete('/:id', authorize('Super Admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await branchesTable.delete(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        res.json({ message: 'Branch deleted successfully' });
    } catch (error) {
        console.error('Error deleting branch:', error);
        res.status(500).json({ error: 'Failed to delete branch' });
    }
});

export default router;
