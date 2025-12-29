const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.use(adminMiddleware);

// Get activity logs
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const action = req.query.action;

        let query = 'SELECT * FROM activity_logs';
        let params = [];

        if (action) {
            query += ' WHERE action = ?';
            params.push(action);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const logs = await db.all(query, params);

        const total = await db.get('SELECT COUNT(*) as count FROM activity_logs');

        res.json({
            success: true,
            logs,
            total: total.count,
            limit,
            offset
        });

    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity logs'
        });
    }
});

// Clear old activity logs
router.delete('/cleanup', async (req, res) => {
    try {
        const daysToKeep = parseInt(req.query.days) || 30;

        const result = await db.run(
            'DELETE FROM activity_logs WHERE timestamp < datetime("now", ? || " days")',
            [-daysToKeep]
        );

        res.json({
            success: true,
            message: `Deleted ${result.changes} old log entries`,
            deleted: result.changes
        });

    } catch (error) {
        console.error('Cleanup logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup logs'
        });
    }
});

module.exports = router;
