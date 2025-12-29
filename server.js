const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const licenseRoutes = require('./routes/licenses');
const statsRoutes = require('./routes/stats');
const activityRoutes = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Required for Railway/Heroku/Render reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/activity', activityRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

app.listen(PORT, () => {
    console.log(`╔════════════════════════════════════════════════╗`);
    console.log(`║   Comet Admin Panel Server                     ║`);
    console.log(`╠════════════════════════════════════════════════╣`);
    console.log(`║   Server running on: http://localhost:${PORT}   ║`);
    console.log(`║   Environment: ${process.env.NODE_ENV}                    ║`);
    console.log(`╚════════════════════════════════════════════════╝`);
});

module.exports = app;
