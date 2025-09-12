/**
 * SonoranCAD Web Application
 * Main server file with simple cookie-based authentication
 */

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Import configuration and utilities
const config = require('./config/config');
const logger = require('./utils/logger');
const database = require('./config/hybrid-database');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/error');

// Import routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: config.server.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: {
            message: 'Too many requests from this IP',
            statusCode: 429,
            type: 'RateLimitError'
        }
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// EJS layout setup
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'admin/layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Static files
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        logger.info(`${req.method} ${req.url} ${res.statusCode}`, {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id || 'anonymous'
        });
    });
    
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/admin', require('./routes/admin'));
app.use('/', webRoutes);

// Error handling middleware
app.use(errorHandler);
app.use(notFoundHandler);

// Initialize database and start server
async function startServer() {
    try {
        await database.initialize();
        
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📖 API Version: 1.0.0`);
            console.log(`🔗 Visit http://localhost:${PORT} to get started`);
        });
    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

// Start the server
startServer();