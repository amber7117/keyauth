const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.use(adminMiddleware);

// Get dashboard statistics
router.get('/', async (req, res) => {
    try {
        // Total users
        const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');

        // Active subscriptions
        const activeSubscriptions = await db.get(
            'SELECT COUNT(*) as count FROM subscriptions WHERE is_active = 1 AND expiry_date > datetime("now")'
        );

        // Expired subscriptions
        const expiredSubscriptions = await db.get(
            'SELECT COUNT(*) as count FROM subscriptions WHERE expiry_date <= datetime("now")'
        );

        // Total licenses
        const totalLicenses = await db.get('SELECT COUNT(*) as count FROM licenses');

        // Unused licenses
        const unusedLicenses = await db.get('SELECT COUNT(*) as count FROM licenses WHERE status = "unused"');

        // Used licenses
        const usedLicenses = await db.get('SELECT COUNT(*) as count FROM licenses WHERE status = "used"');

        // Banned users
        const bannedUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE is_banned = 1');

        // Recent logins (last 24 hours)
        const recentLogins = await db.get(
            'SELECT COUNT(*) as count FROM users WHERE last_login >= datetime("now", "-1 day")'
        );

        // New users (last 7 days)
        const newUsers = await db.get(
            'SELECT COUNT(*) as count FROM users WHERE created_at >= datetime("now", "-7 days")'
        );

        // Revenue by subscription type (if you have pricing)
        const subscriptionTypes = await db.all(`
            SELECT 
                subscription_type,
                COUNT(*) as count
            FROM licenses
            WHERE status = 'used'
            GROUP BY subscription_type
        `);

        // User growth over last 30 days
        const userGrowth = await db.all(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM users
            WHERE created_at >= datetime('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Expiring subscriptions (next 7 days)
        const expiringSoon = await db.all(`
            SELECT 
                u.username,
                s.subscription_name,
                s.expiry_date
            FROM subscriptions s
            JOIN users u ON s.user_id = u.id
            WHERE s.is_active = 1 
            AND s.expiry_date > datetime('now')
            AND s.expiry_date <= datetime('now', '+7 days')
            ORDER BY s.expiry_date ASC
        `);

        res.json({
            success: true,
            stats: {
                users: {
                    total: totalUsers.count,
                    new: newUsers.count,
                    banned: bannedUsers.count,
                    recentLogins: recentLogins.count
                },
                subscriptions: {
                    active: activeSubscriptions.count,
                    expired: expiredSubscriptions.count,
                    expiringSoon: expiringSoon.length
                },
                licenses: {
                    total: totalLicenses.count,
                    unused: unusedLicenses.count,
                    used: usedLicenses.count
                },
                subscriptionTypes,
                userGrowth,
                expiringSoon
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

module.exports = router;
