import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireModulePermission } from '../middleware/rbac';
import { query, queryOne, insert, execute, buildInsert, buildUpdate, transaction } from '../../mysql/config/database';

const router = Router();

// ============================================================================
// LEADS CRUD
// ============================================================================

// List all leads
router.get('/', authenticate, requireModulePermission('leads'), async (req: AuthRequest, res: Response) => {
    try {
        const { status, stage, source, assigned_to, university_id, search, limit, offset } = req.query;

        let sql = 'SELECT * FROM leads WHERE 1=1';
        const params: any[] = [];

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (stage) {
            sql += ' AND stage = ?';
            params.push(stage);
        }

        if (source) {
            sql += ' AND source = ?';
            params.push(source);
        }

        if (assigned_to) {
            sql += ' AND assigned_to_email = ?';
            params.push(assigned_to);
        }

        if (university_id) {
            sql += ' AND university_id = ?';
            params.push(university_id);
        }

        if (search) {
            sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY created_at DESC';

        if (limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(limit as string));
        }

        if (offset) {
            sql += ' OFFSET ?';
            params.push(parseInt(offset as string));
        }

        const leads = await query(sql, params);

        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM leads WHERE 1=1';
        const countParams: any[] = [];

        if (status) {
            countSql += ' AND status = ?';
            countParams.push(status);
        }
        if (stage) {
            countSql += ' AND stage = ?';
            countParams.push(stage);
        }
        if (search) {
            countSql += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const countResult = await queryOne(countSql, countParams);

        res.json({
            data: leads,
            total: countResult?.total || 0,
            limit: limit ? parseInt(limit as string) : null,
            offset: offset ? parseInt(offset as string) : 0,
        });
    } catch (error) {
        console.error('List leads error:', error);
        res.status(500).json({ error: 'Failed to list leads' });
    }
});

// Get single lead with documents and timeline
router.get('/:id', authenticate, requireModulePermission('leads'), async (req: AuthRequest, res: Response) => {
    try {
        const lead = await queryOne('SELECT * FROM leads WHERE id = ?', [req.params.id]);

        if (!lead) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }

        // Get documents
        const documents = await query(
            'SELECT * FROM lead_documents WHERE lead_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );

        // Get timeline
        const timeline = await query(
            'SELECT * FROM lead_timeline WHERE lead_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );

        // Get university if exists
        let university = null;
        if (lead.university_id) {
            university = await queryOne(
                'SELECT id, name, country FROM universities WHERE id = ?',
                [lead.university_id]
            );
        }

        res.json({
            ...lead,
            documents,
            timeline,
            university,
        });
    } catch (error) {
        console.error('Get lead error:', error);
        res.status(500).json({ error: 'Failed to get lead' });
    }
});

// Create lead
router.post('/', authenticate, requireModulePermission('leads', 'add'), async (req: AuthRequest, res: Response) => {
    try {
        const { first_name, last_name, email, phone, source, status, stage, assigned_to_email, university_id, tags, remarks } = req.body;

        if (!first_name || !email) {
            res.status(400).json({ error: 'First name and email are required' });
            return;
        }

        const leadData: any = {
            first_name,
            last_name: last_name || null,
            email: email.toLowerCase(),
            phone: phone || null,
            source: source || null,
            status: status || 'new',
            stage: stage || null,
            assigned_to_email: assigned_to_email || null,
            university_id: university_id || null,
            tags: tags ? JSON.stringify(tags) : null,
            remarks: remarks || null,
        };

        const { sql, params } = buildInsert('leads', leadData);
        const leadId = await insert(sql, params);

        // Add timeline entry
        await insert(
            'INSERT INTO lead_timeline (lead_id, action, detail, created_by_email) VALUES (?, ?, ?, ?)',
            [leadId, 'Lead Created', `Lead created by ${req.user!.email}`, req.user!.email]
        );

        res.status(201).json({ message: 'Lead created successfully', id: leadId });
    } catch (error) {
        console.error('Create lead error:', error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

// Update lead
router.put('/:id', authenticate, requireModulePermission('leads', 'edit'), async (req: AuthRequest, res: Response) => {
    try {
        const existing = await queryOne('SELECT * FROM leads WHERE id = ?', [req.params.id]);
        if (!existing) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }

        const { first_name, last_name, email, phone, source, status, stage, assigned_to_email, university_id, tags, remarks } = req.body;

        const updateData: any = {};
        if (first_name) updateData.first_name = first_name;
        if (last_name !== undefined) updateData.last_name = last_name;
        if (email) updateData.email = email.toLowerCase();
        if (phone !== undefined) updateData.phone = phone;
        if (source) updateData.source = source;
        if (status) updateData.status = status;
        if (stage !== undefined) updateData.stage = stage;
        if (assigned_to_email !== undefined) updateData.assigned_to_email = assigned_to_email;
        if (university_id !== undefined) updateData.university_id = university_id;
        if (tags) updateData.tags = JSON.stringify(tags);
        if (remarks !== undefined) updateData.remarks = remarks;

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }

        const { sql, params } = buildUpdate('leads', updateData, { id: req.params.id });
        await execute(sql, params);

        // Add timeline entry for significant changes
        if (status && status !== existing.status) {
            await insert(
                'INSERT INTO lead_timeline (lead_id, action, detail, created_by_email) VALUES (?, ?, ?, ?)',
                [req.params.id, 'Status Changed', `Status changed from ${existing.status} to ${status}`, req.user!.email]
            );
        }

        if (stage && stage !== existing.stage) {
            await insert(
                'INSERT INTO lead_timeline (lead_id, action, detail, created_by_email) VALUES (?, ?, ?, ?)',
                [req.params.id, 'Stage Changed', `Stage changed to ${stage}`, req.user!.email]
            );
        }

        res.json({ message: 'Lead updated successfully' });
    } catch (error) {
        console.error('Update lead error:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// Delete lead
router.delete('/:id', authenticate, requireModulePermission('leads', 'delete'), async (req: AuthRequest, res: Response) => {
    try {
        const existing = await queryOne('SELECT id FROM leads WHERE id = ?', [req.params.id]);
        if (!existing) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }

        await execute('DELETE FROM leads WHERE id = ?', [req.params.id]);
        res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Delete lead error:', error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

// Add document to lead
router.post('/:id/documents', authenticate, requireModulePermission('leads', 'edit'), async (req: AuthRequest, res: Response) => {
    try {
        const { doc_type, file_url } = req.body;

        if (!doc_type || !file_url) {
            res.status(400).json({ error: 'Document type and file URL are required' });
            return;
        }

        const lead = await queryOne('SELECT id FROM leads WHERE id = ?', [req.params.id]);
        if (!lead) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }

        const docId = await insert(
            'INSERT INTO lead_documents (lead_id, doc_type, file_url, uploaded_by_email) VALUES (?, ?, ?, ?)',
            [req.params.id, doc_type, file_url, req.user!.email]
        );

        // Add timeline entry
        await insert(
            'INSERT INTO lead_timeline (lead_id, action, detail, created_by_email) VALUES (?, ?, ?, ?)',
            [req.params.id, 'Document Added', `${doc_type} document uploaded`, req.user!.email]
        );

        res.status(201).json({ message: 'Document added successfully', id: docId });
    } catch (error) {
        console.error('Add document error:', error);
        res.status(500).json({ error: 'Failed to add document' });
    }
});

// Add timeline entry
router.post('/:id/timeline', authenticate, requireModulePermission('leads'), async (req: AuthRequest, res: Response) => {
    try {
        const { action, detail } = req.body;

        if (!action) {
            res.status(400).json({ error: 'Action is required' });
            return;
        }

        const lead = await queryOne('SELECT id FROM leads WHERE id = ?', [req.params.id]);
        if (!lead) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }

        const timelineId = await insert(
            'INSERT INTO lead_timeline (lead_id, action, detail, created_by_email) VALUES (?, ?, ?, ?)',
            [req.params.id, action, detail || null, req.user!.email]
        );

        res.status(201).json({ message: 'Timeline entry added successfully', id: timelineId });
    } catch (error) {
        console.error('Add timeline error:', error);
        res.status(500).json({ error: 'Failed to add timeline entry' });
    }
});

export default router;
