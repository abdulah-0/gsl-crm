import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireModulePermission } from '../middleware/rbac';
import { query, queryOne, insert, execute, buildInsert, buildUpdate } from '../../mysql/config/database';

const router = Router();

// ============================================================================
// UNIVERSITIES CRUD
// ============================================================================

// List all universities
router.get('/', authenticate, requireModulePermission('universities'), async (req: AuthRequest, res: Response) => {
    try {
        const { country, affiliation_type, search, limit, offset } = req.query;

        let sql = 'SELECT * FROM universities WHERE 1=1';
        const params: any[] = [];

        if (country) {
            sql += ' AND country = ?';
            params.push(country);
        }

        if (affiliation_type) {
            sql += ' AND affiliation_type = ?';
            params.push(affiliation_type);
        }

        if (search) {
            sql += ' AND (name LIKE ? OR country LIKE ? OR address LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY name ASC';

        if (limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(limit as string));
        }

        if (offset) {
            sql += ' OFFSET ?';
            params.push(parseInt(offset as string));
        }

        const universities = await query(sql, params);

        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM universities WHERE 1=1';
        const countParams: any[] = [];

        if (country) {
            countSql += ' AND country = ?';
            countParams.push(country);
        }
        if (affiliation_type) {
            countSql += ' AND affiliation_type = ?';
            countParams.push(affiliation_type);
        }
        if (search) {
            countSql += ' AND (name LIKE ? OR country LIKE ? OR address LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        const countResult = await queryOne(countSql, countParams);

        res.json({
            data: universities,
            total: countResult?.total || 0,
            limit: limit ? parseInt(limit as string) : null,
            offset: offset ? parseInt(offset as string) : 0,
        });
    } catch (error) {
        console.error('List universities error:', error);
        res.status(500).json({ error: 'Failed to list universities' });
    }
});

// Get single university
router.get('/:id', authenticate, requireModulePermission('universities'), async (req: AuthRequest, res: Response) => {
    try {
        const university = await queryOne('SELECT * FROM universities WHERE id = ?', [req.params.id]);

        if (!university) {
            res.status(404).json({ error: 'University not found' });
            return;
        }

        // Get related leads count
        const leadsCount = await queryOne(
            'SELECT COUNT(*) as count FROM leads WHERE university_id = ?',
            [req.params.id]
        );

        // Get related cases count
        const casesCount = await queryOne(
            'SELECT COUNT(*) as count FROM dashboard_cases WHERE university_id = ?',
            [req.params.id]
        );

        res.json({
            ...university,
            stats: {
                leads: leadsCount?.count || 0,
                cases: casesCount?.count || 0,
            },
        });
    } catch (error) {
        console.error('Get university error:', error);
        res.status(500).json({ error: 'Failed to get university' });
    }
});

// Create university
router.post('/', authenticate, requireModulePermission('universities', 'add'), async (req: AuthRequest, res: Response) => {
    try {
        const { name, country, ranking, notes, affiliation_type, website, address, contact_email, contact_phone } = req.body;

        if (!name) {
            res.status(400).json({ error: 'University name is required' });
            return;
        }

        const universityData: any = {
            name,
            country: country || null,
            ranking: ranking || null,
            notes: notes || null,
            affiliation_type: affiliation_type || null,
            website: website || null,
            address: address || null,
            contact_email: contact_email || null,
            contact_phone: contact_phone || null,
        };

        const { sql, params } = buildInsert('universities', universityData);
        const universityId = await insert(sql, params);

        res.status(201).json({ message: 'University created successfully', id: universityId });
    } catch (error) {
        console.error('Create university error:', error);
        res.status(500).json({ error: 'Failed to create university' });
    }
});

// Bulk import universities
router.post('/bulk', authenticate, requireModulePermission('universities', 'add'), async (req: AuthRequest, res: Response) => {
    try {
        const { universities } = req.body;

        if (!Array.isArray(universities) || universities.length === 0) {
            res.status(400).json({ error: 'Universities array is required' });
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: any[] = [];

        for (const uni of universities) {
            try {
                if (!uni.name) {
                    errorCount++;
                    errors.push({ university: uni, error: 'Name is required' });
                    continue;
                }

                const universityData: any = {
                    name: uni.name,
                    country: uni.country || null,
                    ranking: uni.ranking || null,
                    notes: uni.notes || null,
                    affiliation_type: uni.affiliation_type || null,
                    website: uni.website || null,
                    address: uni.address || null,
                    contact_email: uni.contact_email || null,
                    contact_phone: uni.contact_phone || null,
                };

                const { sql, params } = buildInsert('universities', universityData);
                await insert(sql, params);
                successCount++;
            } catch (err) {
                errorCount++;
                errors.push({ university: uni, error: String(err) });
            }
        }

        res.json({
            message: 'Bulk import completed',
            success: successCount,
            errors: errorCount,
            errorDetails: errors,
        });
    } catch (error) {
        console.error('Bulk import error:', error);
        res.status(500).json({ error: 'Failed to import universities' });
    }
});

// Update university
router.put('/:id', authenticate, requireModulePermission('universities', 'edit'), async (req: AuthRequest, res: Response) => {
    try {
        const existing = await queryOne('SELECT id FROM universities WHERE id = ?', [req.params.id]);
        if (!existing) {
            res.status(404).json({ error: 'University not found' });
            return;
        }

        const { name, country, ranking, notes, affiliation_type, website, address, contact_email, contact_phone } = req.body;

        const updateData: any = {};
        if (name) updateData.name = name;
        if (country !== undefined) updateData.country = country;
        if (ranking !== undefined) updateData.ranking = ranking;
        if (notes !== undefined) updateData.notes = notes;
        if (affiliation_type !== undefined) updateData.affiliation_type = affiliation_type;
        if (website !== undefined) updateData.website = website;
        if (address !== undefined) updateData.address = address;
        if (contact_email !== undefined) updateData.contact_email = contact_email;
        if (contact_phone !== undefined) updateData.contact_phone = contact_phone;

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }

        const { sql, params } = buildUpdate('universities', updateData, { id: req.params.id });
        await execute(sql, params);

        res.json({ message: 'University updated successfully' });
    } catch (error) {
        console.error('Update university error:', error);
        res.status(500).json({ error: 'Failed to update university' });
    }
});

// Delete university
router.delete('/:id', authenticate, requireModulePermission('universities', 'delete'), async (req: AuthRequest, res: Response) => {
    try {
        const existing = await queryOne('SELECT id FROM universities WHERE id = ?', [req.params.id]);
        if (!existing) {
            res.status(404).json({ error: 'University not found' });
            return;
        }

        // Check if university is referenced by leads or cases
        const leadsCount = await queryOne(
            'SELECT COUNT(*) as count FROM leads WHERE university_id = ?',
            [req.params.id]
        );

        const casesCount = await queryOne(
            'SELECT COUNT(*) as count FROM dashboard_cases WHERE university_id = ?',
            [req.params.id]
        );

        if ((leadsCount?.count || 0) > 0 || (casesCount?.count || 0) > 0) {
            res.status(400).json({
                error: 'Cannot delete university with associated leads or cases',
                leads: leadsCount?.count || 0,
                cases: casesCount?.count || 0,
            });
            return;
        }

        await execute('DELETE FROM universities WHERE id = ?', [req.params.id]);
        res.json({ message: 'University deleted successfully' });
    } catch (error) {
        console.error('Delete university error:', error);
        res.status(500).json({ error: 'Failed to delete university' });
    }
});

// Get countries list
router.get('/meta/countries', authenticate, requireModulePermission('universities'), async (req: AuthRequest, res: Response) => {
    try {
        const countries = await query(
            'SELECT DISTINCT country FROM universities WHERE country IS NOT NULL ORDER BY country ASC'
        );

        res.json(countries.map(c => c.country));
    } catch (error) {
        console.error('Get countries error:', error);
        res.status(500).json({ error: 'Failed to get countries' });
    }
});

// Get affiliation types list
router.get('/meta/affiliation-types', authenticate, requireModulePermission('universities'), async (req: AuthRequest, res: Response) => {
    try {
        const types = await query(
            'SELECT DISTINCT affiliation_type FROM universities WHERE affiliation_type IS NOT NULL ORDER BY affiliation_type ASC'
        );

        res.json(types.map(t => t.affiliation_type));
    } catch (error) {
        console.error('Get affiliation types error:', error);
        res.status(500).json({ error: 'Failed to get affiliation types' });
    }
});

export default router;
