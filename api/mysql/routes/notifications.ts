import express, { Request, Response } from 'express';
import { TableOperations, paginate } from '../utils/dbHelpers';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const notificationsTable = new TableOperations('notifications');

// Apply authentication to all routes
router.use(authenticate);

/**
 * GET /api/mysql/notifications
 * Get all notifications for current user
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { page, pageSize, isRead, type } = req.query;

        // Build filters - always filter by current user
        const filters: Record<string, any> = {
            user_id: req.user?.id
        };

        if (isRead !== undefined) {
            filters.is_read = isRead === 'true';
        }
        if (type) {
            filters.type = type;
        }

        // Paginated results
        const result = await paginate('notifications', filters, {
            page: page ? parseInt(page as string) : 1,
            pageSize: pageSize ? parseInt(pageSize as string) : 20,
            orderBy: 'created_at',
            orderDirection: 'DESC'
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/**
 * GET /api/mysql/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', async (req: Request, res: Response) => {
    try {
        const count = await notificationsTable.count({
            user_id: req.user?.id,
            is_read: false
        });

        res.json({ count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

/**
 * GET /api/mysql/notifications/:id
 * Get a single notification by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const notification = await notificationsTable.getById(id);

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        // Ensure user can only access their own notifications
        if (notification.user_id !== req.user?.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(notification);
    } catch (error) {
        console.error('Error fetching notification:', error);
        res.status(500).json({ error: 'Failed to fetch notification' });
    }
});

/**
 * PUT /api/mysql/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if notification exists and belongs to user
        const notification = await notificationsTable.getById(id);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        if (notification.user_id !== req.user?.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await notificationsTable.update(id, {
            is_read: true,
            read_at: new Date()
        });

        res.json({
            message: 'Notification marked as read',
            ...result
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

/**
 * PUT /api/mysql/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
router.put('/mark-all-read', async (req: Request, res: Response) => {
    try {
        const result = await notificationsTable.updateWhere(
            { user_id: req.user?.id, is_read: false },
            { is_read: true, read_at: new Date() }
        );

        res.json({
            message: 'All notifications marked as read',
            ...result
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});

/**
 * DELETE /api/mysql/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if notification exists and belongs to user
        const notification = await notificationsTable.getById(id);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        if (notification.user_id !== req.user?.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await notificationsTable.delete(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

/**
 * DELETE /api/mysql/notifications/clear-all
 * Delete all read notifications for current user
 */
router.delete('/clear-all', async (req: Request, res: Response) => {
    try {
        const result = await notificationsTable.deleteWhere({
            user_id: req.user?.id,
            is_read: true
        });

        res.json({
            message: 'All read notifications cleared',
            ...result
        });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ error: 'Failed to clear notifications' });
    }
});

export default router;
