import express, { Request, Response } from 'express';
import { TableOperations, paginate, search } from '../utils/dbHelpers';
import { authenticate, requirePermission } from '../middleware/auth';
import { query } from '../../mysql/config/database';

const router = express.Router();
const tasksTable = new TableOperations('dashboard_tasks');
const notificationsTable = new TableOperations('notifications');

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/mysql/tasks
 * Get all tasks with pagination and filtering
 */
router.get('/', requirePermission('tasks'), async (req: Request, res: Response) => {
    try {
        const {
            page,
            pageSize,
            status,
            priority,
            assignedTo,
            assigneeId,
            caseId,
            branchId,
            search: searchTerm
        } = req.query;

        // Build filters
        const filters: Record<string, any> = {};
        if (status) filters.status = status;
        if (priority) filters.priority = priority;
        if (assignedTo) filters.assigned_to = assignedTo;
        if (assigneeId) filters.assignee_id = assigneeId;
        if (caseId) filters.case_id = caseId;

        // Branch filtering for non-Super Admin users
        if (req.user?.role !== 'Super Admin' && req.user?.branchId) {
            filters.branch_id = req.user.branchId;
        } else if (branchId) {
            filters.branch_id = branchId;
        }

        // Search functionality
        if (searchTerm) {
            const results = await search(
                'dashboard_tasks',
                ['title', 'description'],
                searchTerm as string,
                filters
            );
            return res.json({ data: results });
        }

        // Paginated results
        const result = await paginate('dashboard_tasks', filters, {
            page: page ? parseInt(page as string) : 1,
            pageSize: pageSize ? parseInt(pageSize as string) : 20,
            orderBy: 'due_date',
            orderDirection: 'ASC'
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

/**
 * GET /api/mysql/tasks/my-tasks
 * Get tasks assigned to current user
 */
router.get('/my-tasks', requirePermission('tasks'), async (req: Request, res: Response) => {
    try {
        const { status, priority } = req.query;

        const filters: Record<string, any> = {
            assignee_id: req.user?.id
        };

        if (status) filters.status = status;
        if (priority) filters.priority = priority;

        const tasks = await tasksTable.getAll(filters, 'due_date ASC');
        res.json({ data: tasks });
    } catch (error) {
        console.error('Error fetching my tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

/**
 * GET /api/mysql/tasks/:id
 * Get a single task by ID
 */
router.get('/:id', requirePermission('tasks'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const task = await tasksTable.getById(id);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && task.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(task);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

/**
 * POST /api/mysql/tasks
 * Create a new task
 */
router.post('/', requirePermission('tasks'), async (req: Request, res: Response) => {
    try {
        const taskData = req.body;

        // Validate required fields
        if (!taskData.title) {
            return res.status(400).json({ error: 'Missing required field: title' });
        }

        // Set defaults
        taskData.status = taskData.status || 'Pending';
        taskData.priority = taskData.priority || 'Medium';
        taskData.created_by = req.user?.id;

        // Set branch_id from current user if not Super Admin
        if (req.user?.role !== 'Super Admin' && !taskData.branch_id) {
            taskData.branch_id = req.user?.branchId;
        }

        const result = await tasksTable.create(taskData);

        // Create notification for assignee
        if (taskData.assignee_id) {
            await notificationsTable.create({
                user_id: taskData.assignee_id,
                type: 'task_assigned',
                title: 'New Task Assigned',
                message: `You have been assigned a new task: ${taskData.title}`,
                link: `/tasks/${result.id}`,
                related_id: result.id.toString()
            });
        }

        res.status(201).json({
            message: 'Task created successfully',
            id: result.id,
            ...result
        });
    } catch (error: any) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

/**
 * PUT /api/mysql/tasks/:id
 * Update a task
 */
router.put('/:id', requirePermission('tasks'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Check if task exists
        const existingTask = await tasksTable.getById(id);
        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && existingTask.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Set completed_at if status changed to Completed
        if (updates.status === 'Completed' && existingTask.status !== 'Completed') {
            updates.completed_at = new Date();
        }

        // Don't allow changing ID
        delete updates.id;

        const result = await tasksTable.update(id, updates);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Create notification if assignee changed
        if (updates.assignee_id && updates.assignee_id !== existingTask.assignee_id) {
            await notificationsTable.create({
                user_id: updates.assignee_id,
                type: 'task_assigned',
                title: 'Task Reassigned',
                message: `A task has been assigned to you: ${existingTask.title}`,
                link: `/tasks/${id}`,
                related_id: id
            });
        }

        res.json({
            message: 'Task updated successfully',
            ...result
        });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

/**
 * DELETE /api/mysql/tasks/:id
 * Delete a task
 */
router.delete('/:id', requirePermission('tasks'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if task exists
        const existingTask = await tasksTable.getById(id);
        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check branch access
        if (req.user?.role !== 'Super Admin' && existingTask.branch_id !== req.user?.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await tasksTable.delete(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

/**
 * GET /api/mysql/tasks/stats/summary
 * Get task statistics
 */
router.get('/stats/summary', requirePermission('tasks'), async (req: Request, res: Response) => {
    try {
        const branchFilter = req.user?.role !== 'Super Admin' && req.user?.branchId
            ? `WHERE branch_id = ${req.user.branchId}`
            : '';

        const stats = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN due_date < CURDATE() AND status != 'Completed' THEN 1 ELSE 0 END) as overdue
      FROM dashboard_tasks
      ${branchFilter}
    `);

        res.json(stats[0]);
    } catch (error) {
        console.error('Error fetching task stats:', error);
        res.status(500).json({ error: 'Failed to fetch task statistics' });
    }
});

export default router;
