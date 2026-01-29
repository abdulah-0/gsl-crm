import express, { Request, Response } from 'express';
import { TableOperations, paginate, search, generateId } from '../utils/dbHelpers';
import { authenticate, requirePermission } from '../middleware/auth';
import { query } from '../../mysql/config/database';

const router = express.Router();
const casesTable = new TableOperations('dashboard_cases');

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/mysql/cases
 * Get all cases with pagination and filtering
 */
router.get('/', requirePermission('cases'), async (req: Request, res: Response) => {
    try {
        const {
            page,
            pageSize,
            status,
            stage,
            priority,
            assignedTo,
            studentId,
            branchId,
            search: searchTerm
        } = req.query;

        // Build filters
        const filters: Record<string, any> = {};
        if (status) filters.status = status;
        if (stage) filters.stage = stage;
        if (priority) filters.priority = priority;
        if (assignedTo) filters.assigned_to = assignedTo;
        if (studentId) filters.student_id = studentId;

        // Branch filtering for non-Super Admin users
        if (req.user?.role !== 'Super Admin' && req.user?.branchId) {
            filters.branch_id = req.user.branchId;
        } else if (branchId) {
            filters.branch_id = branchId;
        }

        // Search functionality
        if (searchTerm) {
            const results = await search(
                'dashboard_cases',
                ['id', 'student_name', 'student_email', 'student_phone', 'description'],
                searchTerm as string,
                filters
            );
            return res.json({ data: results });
        }

        // Paginated results
        const result = await paginate('dashboard_cases', filters, {
            page: page ? parseInt(page as string) : 1,
            pageSize: pageSize ? parseInt(pageSize as string) : 20,
            orderBy: 'created_at',
            orderDirection: 'DESC'
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ error: 'Failed to fetch cases' });
    }
});

/**
 * GET /api/mysql/cases/:id
 * Get a single case by ID
 */
router.get('/:id', requirePermission('cases'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get case with related data
        const caseData = await query(`
      SELECT 
        c.*,
        s.full_name as student_full_name,
        s.email as student_email_verified,
        s.phone as student_phone_verified,
        srv.name as service_name_verified,
        u.name as university_name,
        u.country as university_country
      FROM dashboard_cases c
      LEFT JOIN dashboard_students s ON c.student_id = s.id
      LEFT JOIN dashboard_services srv ON c.service_id = srv.id
      LEFT JOIN universities u ON c.university_id = u.id
      WHERE c.id = ?
    `, [id]);

        if (!caseData || caseData.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseRecord = caseData[0];

        // Check branch access
        if (req.user?.role !== 'Super Admin' && caseRecord.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get application history
        const history = await query(`
      SELECT * FROM application_history
      WHERE case_id = ?
      ORDER BY created_at DESC
    `, [id]);

        res.json({
            ...caseRecord,
            history
        });
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ error: 'Failed to fetch case' });
    }
});

/**
 * POST /api/mysql/cases
 * Create a new case
 */
router.post('/', requirePermission('cases'), async (req: Request, res: Response) => {
    try {
        const caseData = req.body;

        // Validate required fields
        if (!caseData.student_id) {
            return res.status(400).json({ error: 'Missing required field: student_id' });
        }

        // Generate case ID if not provided
        if (!caseData.id) {
            caseData.id = generateId('CS');
        }

        // Set defaults
        caseData.status = caseData.status || 'Open';
        caseData.priority = caseData.priority || 'Medium';
        caseData.created_by = req.user?.id;

        // Set branch_id from current user if not Super Admin
        if (req.user?.role !== 'Super Admin' && !caseData.branch_id) {
            caseData.branch_id = req.user?.branchId;
        }

        const result = await casesTable.create(caseData);

        res.status(201).json({
            message: 'Case created successfully',
            id: caseData.id,
            ...result
        });
    } catch (error: any) {
        console.error('Error creating case:', error);
        res.status(500).json({ error: 'Failed to create case' });
    }
});

/**
 * PUT /api/mysql/cases/:id
 * Update a case
 */
router.put('/:id', requirePermission('cases'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Check if case exists
        const existingCase = await casesTable.getById(id);
        if (!existingCase) {
            return res.status(404).json({ error: 'Case not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && existingCase.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Track stage changes
        if (updates.stage && updates.stage !== existingCase.stage) {
            await query(`
        INSERT INTO application_history (case_id, old_stage, new_stage, changed_by, notes)
        VALUES (?, ?, ?, ?, ?)
      `, [id, existingCase.stage, updates.stage, req.user?.id, updates.notes || null]);
        }

        // Don't allow changing ID
        delete updates.id;

        const result = await casesTable.update(id, updates);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        res.json({
            message: 'Case updated successfully',
            ...result
        });
    } catch (error) {
        console.error('Error updating case:', error);
        res.status(500).json({ error: 'Failed to update case' });
    }
});

/**
 * DELETE /api/mysql/cases/:id
 * Delete a case
 */
router.delete('/:id', requirePermission('cases'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if case exists
        const existingCase = await casesTable.getById(id);
        if (!existingCase) {
            return res.status(404).json({ error: 'Case not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && existingCase.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await casesTable.delete(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        res.json({ message: 'Case deleted successfully' });
    } catch (error) {
        console.error('Error deleting case:', error);
        res.status(500).json({ error: 'Failed to delete case' });
    }
});

/**
 * GET /api/mysql/cases/stats/summary
 * Get case statistics
 */
router.get('/stats/summary', requirePermission('cases'), async (req: Request, res: Response) => {
    try {
        const branchFilter = req.user?.role !== 'Super Admin' && req.user?.branchId
            ? `WHERE branch_id = ${req.user.branchId}`
            : '';

        const stats = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open_cases,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN priority = 'Urgent' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN priority = 'High' THEN 1 ELSE 0 END) as high_priority
      FROM dashboard_cases
      ${branchFilter}
    `);

        res.json(stats[0]);
    } catch (error) {
        console.error('Error fetching case stats:', error);
        res.status(500).json({ error: 'Failed to fetch case statistics' });
    }
});

/**
 * GET /api/mysql/cases/:id/history
 * Get application history for a case
 */
router.get('/:id/history', requirePermission('cases'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if case exists and user has access
        const caseRecord = await casesTable.getById(id);
        if (!caseRecord) {
            return res.status(404).json({ error: 'Case not found' });
        }

        if (req.user?.role !== 'Super Admin' && caseRecord.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const history = await query(`
      SELECT 
        ah.*,
        u.full_name as changed_by_name
      FROM application_history ah
      LEFT JOIN dashboard_users u ON ah.changed_by = u.id
      WHERE ah.case_id = ?
      ORDER BY ah.created_at DESC
    `, [id]);

        res.json(history);
    } catch (error) {
        console.error('Error fetching case history:', error);
        res.status(500).json({ error: 'Failed to fetch case history' });
    }
});

export default router;
