const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// Admin login
router.post('/login', async (req, res) => {
    try {
        const { username, password, twoFactorCode } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const admin = await db.get('SELECT * FROM admins WHERE username = ?', [username]);

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check 2FA if enabled
        if (admin.two_factor_enabled) {
            if (!twoFactorCode) {
                return res.status(200).json({
                    success: false,
                    message: '2FA code required',
                    requires2FA: true
                });
            }

            const verified = speakeasy.totp.verify({
                secret: admin.two_factor_secret,
                encoding: 'base32',
                token: twoFactorCode,
                window: 2
            });

            if (!verified) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid 2FA code'
                });
            }
        }

        // Update last login
        await db.run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

        // Generate JWT token
        const token = jwt.sign(
            {
                id: admin.id,
                username: admin.username,
                role: admin.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                email: admin.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// Enable 2FA
router.post('/2fa/enable', authMiddleware, async (req, res) => {
    try {
        const secret = speakeasy.generateSecret({
            name: `Comet Admin (${req.user.username})`
        });

        const qrCode = await QRCode.toDataURL(secret.otpauth_url);

        res.json({
            success: true,
            secret: secret.base32,
            qrCode
        });

    } catch (error) {
        console.error('2FA enable error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enable 2FA'
        });
    }
});

// Verify and activate 2FA
router.post('/2fa/verify', authMiddleware, async (req, res) => {
    try {
        const { secret, code } = req.body;

        const verified = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: code,
            window: 2
        });

        if (verified) {
            await db.run(
                'UPDATE admins SET two_factor_secret = ?, two_factor_enabled = 1 WHERE id = ?',
                [secret, req.user.id]
            );

            res.json({
                success: true,
                message: '2FA enabled successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid 2FA code'
            });
        }

    } catch (error) {
        console.error('2FA verify error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify 2FA'
        });
    }
});

// Disable 2FA
router.post('/2fa/disable', authMiddleware, async (req, res) => {
    try {
        const { code } = req.body;

        const admin = await db.get('SELECT * FROM admins WHERE id = ?', [req.user.id]);

        if (!admin.two_factor_enabled) {
            return res.status(400).json({
                success: false,
                message: '2FA is not enabled'
            });
        }

        const verified = speakeasy.totp.verify({
            secret: admin.two_factor_secret,
            encoding: 'base32',
            token: code,
            window: 2
        });

        if (verified) {
            await db.run(
                'UPDATE admins SET two_factor_secret = NULL, two_factor_enabled = 0 WHERE id = ?',
                [req.user.id]
            );

            res.json({
                success: true,
                message: '2FA disabled successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid 2FA code'
            });
        }

    } catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to disable 2FA'
        });
    }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current and new passwords are required'
            });
        }

        const admin = await db.get('SELECT * FROM admins WHERE id = ?', [req.user.id]);

        const passwordMatch = await bcrypt.compare(currentPassword, admin.password);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.run('UPDATE admins SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
});

module.exports = router;
