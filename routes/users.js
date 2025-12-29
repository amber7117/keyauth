const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await db.all(`
            SELECT 
                u.*,
                GROUP_CONCAT(s.subscription_name || '|' || s.expiry_date) as subscriptions
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id AND s.is_active = 1
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            users: users.map(user => ({
                ...user,
                password: undefined,
                subscriptions: user.subscriptions ? user.subscriptions.split(',').map(sub => {
                    const [name, expiry] = sub.split('|');
                    return { name, expiry };
                }) : []
            }))
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// Get single user
router.get('/:id', async (req, res) => {
    try {
        const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const subscriptions = await db.all(
            'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY expiry_date DESC',
            [req.params.id]
        );

        const activities = await db.all(
            'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50',
            [req.params.id]
        );

        user.password = undefined;

        res.json({
            success: true,
            user: {
                ...user,
                subscriptions,
                activities
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
});

// Create user
router.post('/', async (req, res) => {
    try {
        const { username, password, email, hwid } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.run(
            'INSERT INTO users (username, password, email, hwid) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, email, hwid]
        );

        await db.run(
            'INSERT INTO activity_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
            [result.id, username, 'user_created', `User created by admin ${req.user.username}`]
        );

        res.json({
            success: true,
            message: 'User created successfully',
            userId: result.id
        });

    } catch (error) {
        console.error('Create user error:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({
                success: false,
                message: 'Username or email already exists'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to create user'
            });
        }
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        const { email, hwid, status } = req.body;
        const userId = req.params.id;

        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await db.run(
            'UPDATE users SET email = ?, hwid = ?, status = ? WHERE id = ?',
            [email || user.email, hwid || user.hwid, status || user.status, userId]
        );

        await db.run(
            'INSERT INTO activity_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
            [userId, user.username, 'user_updated', `User updated by admin ${req.user.username}`]
        );

        res.json({
            success: true,
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user'
        });
    }
});

// Ban/Unban user
router.post('/:id/ban', async (req, res) => {
    try {
        const { reason, isBanned } = req.body;
        const userId = req.params.id;

        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await db.run(
            'UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ?',
            [isBanned ? 1 : 0, reason || null, userId]
        );

        await db.run(
            'INSERT INTO activity_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
            [userId, user.username, isBanned ? 'user_banned' : 'user_unbanned', reason || `By admin ${req.user.username}`]
        );

        res.json({
            success: true,
            message: isBanned ? 'User banned successfully' : 'User unbanned successfully'
        });

    } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to ban/unban user'
        });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await db.run('DELETE FROM subscriptions WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM users WHERE id = ?', [userId]);

        await db.run(
            'INSERT INTO activity_logs (username, action, details) VALUES (?, ?, ?)',
            [user.username, 'user_deleted', `User deleted by admin ${req.user.username}`]
        );

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user'
        });
    }
});

// Reset user password
router.post('/:id/reset-password', async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.params.id;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        await db.run(
            'INSERT INTO activity_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
            [userId, user.username, 'password_reset', `Password reset by admin ${req.user.username}`]
        );

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
});

module.exports = router;
