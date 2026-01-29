import express, { Request, Response } from 'express';
import { TableOperations, paginate, search } from '../utils/dbHelpers';
import { authenticate, requirePermission } from '../middleware/auth';

const router = express.Router();
const universitiesTable = new TableOperations('universities');

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/mysql/universities
 * Get all universities with pagination and filtering
 */
router.get('/', requirePermission('universities'), async (req: Request, res: Response) => {
    try {
        const { page, pageSize, country, type, search: searchTerm } = req.query;

        // Build filters
        const filters: Record<string, any> = {};
        if (country) filters.country = country;
        if (type) filters.type = type;

        // Search functionality
        if (searchTerm) {
            const results = await search(
                'universities',
                ['name', 'city', 'country'],
                searchTerm as string,
                filters
            );
            return res.json({ data: results });
        }

        // Paginated results
        const result = await paginate('universities', filters, {
            page: page ? parseInt(page as string) : 1,
            pageSize: pageSize ? parseInt(pageSize as string) : 50,
            orderBy: 'name',
            orderDirection: 'ASC'
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching universities:', error);
        res.status(500).json({ error: 'Failed to fetch universities' });
    }
});

/**
 * GET /api/mysql/universities/:id
 * Get a single university by ID
 */
router.get('/:id', requirePermission('universities'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const university = await universitiesTable.getById(id);

        if (!university) {
            return res.status(404).json({ error: 'University not found' });
        }

        res.json(university);
    } catch (error) {
        console.error('Error fetching university:', error);
        res.status(500).json({ error: 'Failed to fetch university' });
    }
});

/**
 * POST /api/mysql/universities
 * Create a new university
 */
router.post('/', requirePermission('universities'), async (req: Request, res: Response) => {
    try {
        const universityData = req.body;

        // Validate required fields
        if (!universityData.name) {
            return res.status(400).json({ error: 'Missing required field: name' });
        }

        const result = await universitiesTable.create(universityData);
        res.status(201).json({
            message: 'University created successfully',
            id: result.id,
            ...result
        });
    } catch (error: any) {
        console.error('Error creating university:', error);
        res.status(500).json({ error: 'Failed to create university' });
    }
});

/**
 * PUT /api/mysql/universities/:id
 * Update a university
 */
router.put('/:id', requirePermission('universities'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Don't allow changing ID
        delete updates.id;

        const result = await universitiesTable.update(id, updates);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'University not found' });
        }

        res.json({
            message: 'University updated successfully',
            ...result
        });
    } catch (error) {
        console.error('Error updating university:', error);
        res.status(500).json({ error: 'Failed to update university' });
    }
});

/**
 * DELETE /api/mysql/universities/:id
 * Delete a university
 */
router.delete('/:id', requirePermission('universities'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await universitiesTable.delete(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'University not found' });
        }

        res.json({ message: 'University deleted successfully' });
    } catch (error) {
        console.error('Error deleting university:', error);
        res.status(500).json({ error: 'Failed to delete university' });
    }
});

/**
 * GET /api/mysql/universities/countries/list
 * Get list of unique countries
 */
router.get('/countries/list', requirePermission('universities'), async (req: Request, res: Response) => {
    try {
        const countries = await universitiesTable.getAll({}, 'country ASC');
        const uniqueCountries = [...new Set(countries.map((u: any) => u.country).filter(Boolean))];

        res.json(uniqueCountries);
    } catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});

export default router;
