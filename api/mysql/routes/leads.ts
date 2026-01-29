import express, { Request, Response } from 'express';
import { TableOperations, paginate, search, generateId } from '../utils/dbHelpers';
import { authenticate, requirePermission } from '../middleware/auth';
import { query } from '../../mysql/config/database';

const router = express.Router();
const leadsTable = new TableOperations('leads');

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/mysql/leads
 * Get all leads with pagination and filtering
 */
router.get('/', requirePermission('leads'), async (req: Request, res: Response) => {
    try {
        const {
            page,
            pageSize,
            status,
            stage,
            source,
            assignedTo,
            branchId,
            search: searchTerm
        } = req.query;

        // Build filters
        const filters: Record<string, any> = {};
        if (status) filters.status = status;
        if (stage) filters.stage = stage;
        if (source) filters.source = source;
        if (assignedTo) filters.assigned_to = assignedTo;

        // Branch filtering for non-Super Admin users
        if (req.user?.role !== 'Super Admin' && req.user?.branchId) {
            filters.branch_id = req.user.branchId;
        } else if (branchId) {
            filters.branch_id = branchId;
        }

        // Search functionality
        if (searchTerm) {
            const results = await search(
                'leads',
                ['full_name', 'email', 'phone', 'city'],
                searchTerm as string,
                filters
            );
            return res.json({ data: results });
        }

        // Paginated results
        const result = await paginate('leads', filters, {
            page: page ? parseInt(page as string) : 1,
            pageSize: pageSize ? parseInt(pageSize as string) : 20,
            orderBy: 'created_at',
            orderDirection: 'DESC'
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

/**
 * GET /api/mysql/leads/:id
 * Get a single lead by ID
 */
router.get('/:id', requirePermission('leads'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const lead = await leadsTable.getById(id);

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && lead.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(lead);
    } catch (error) {
        console.error('Error fetching lead:', error);
        res.status(500).json({ error: 'Failed to fetch lead' });
    }
});

/**
 * POST /api/mysql/leads
 * Create a new lead
 */
router.post('/', requirePermission('leads'), async (req: Request, res: Response) => {
    try {
        const leadData = req.body;

        // Validate required fields
        if (!leadData.full_name || !leadData.phone) {
            return res.status(400).json({ error: 'Missing required fields: full_name, phone' });
        }

        // Set defaults
        leadData.status = leadData.status || 'New';
        leadData.created_by = req.user?.id;

        // Set branch_id from current user if not Super Admin
        if (req.user?.role !== 'Super Admin' && !leadData.branch_id) {
            leadData.branch_id = req.user?.branchId;
        }

        const result = await leadsTable.create(leadData);
        res.status(201).json({
            message: 'Lead created successfully',
            id: result.id,
            ...result
        });
    } catch (error: any) {
        console.error('Error creating lead:', error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

/**
 * PUT /api/mysql/leads/:id
 * Update a lead
 */
router.put('/:id', requirePermission('leads'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Check if lead exists
        const existingLead = await leadsTable.getById(id);
        if (!existingLead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && existingLead.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Don't allow changing ID
        delete updates.id;

        const result = await leadsTable.update(id, updates);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json({
            message: 'Lead updated successfully',
            ...result
        });
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

/**
 * DELETE /api/mysql/leads/:id
 * Delete a lead
 */
router.delete('/:id', requirePermission('leads'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if lead exists
        const existingLead = await leadsTable.getById(id);
        if (!existingLead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && existingLead.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await leadsTable.delete(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

/**
 * POST /api/mysql/leads/:id/convert
 * Convert a lead to a student/case
 */
router.post('/:id/convert', requirePermission('leads', 'students'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { serviceId, programTitle } = req.body;

        const lead = await leadsTable.getById(id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && lead.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Create student
        const studentId = generateId('ST');
        const studentData = {
            id: studentId,
            full_name: lead.full_name,
            email: lead.email,
            phone: lead.phone,
            city: lead.city,
            program_title: programTitle,
            status: 'Active',
            branch_id: lead.branch_id,
            created_by: req.user?.id
        };

        await query('INSERT INTO dashboard_students SET ?', [studentData]);

        // Create case
        const caseId = generateId('CS');
        const caseData = {
            id: caseId,
            student_id: studentId,
            student_name: lead.full_name,
            student_email: lead.email,
            student_phone: lead.phone,
            service_id: serviceId,
            status: 'Open',
            assigned_to: lead.assigned_to,
            branch_id: lead.branch_id,
            created_by: req.user?.id
        };

        await query('INSERT INTO dashboard_cases SET ?', [caseData]);

        // Update lead status
        await leadsTable.update(id, { status: 'Converted' });

        res.json({
            message: 'Lead converted successfully',
            studentId,
            caseId
        });
    } catch (error) {
        console.error('Error converting lead:', error);
        res.status(500).json({ error: 'Failed to convert lead' });
    }
});

/**
 * GET /api/mysql/leads/stats/summary
 * Get lead statistics
 */
router.get('/stats/summary', requirePermission('leads'), async (req: Request, res: Response) => {
    try {
        const branchFilter = req.user?.role !== 'Super Admin' && req.user?.branchId
            ? `WHERE branch_id = ${req.user.branchId}`
            : '';

        const stats = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) as new_leads,
        SUM(CASE WHEN status = 'Contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'Qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN status = 'Converted' THEN 1 ELSE 0 END) as converted,
        SUM(CASE WHEN status = 'Lost' THEN 1 ELSE 0 END) as lost
      FROM leads
      ${branchFilter}
    `);

        res.json(stats[0]);
    } catch (error) {
        console.error('Error fetching lead stats:', error);
        res.status(500).json({ error: 'Failed to fetch lead statistics' });
    }
});

export default router;
