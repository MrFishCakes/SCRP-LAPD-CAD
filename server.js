/**
 * SonoranCAD Web Application
 * Main server file with modular architecture
 */

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import configuration and utilities
const config = require('./config/config');
const logger = require('./utils/logger');
const database = require('./config/hybrid-database');

// Import middleware
const { addSecurityHeaders, handleAuthError } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/error');

// Import routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet(config.security.helmet));
app.use(addSecurityHeaders);

// CORS configuration
app.use(cors({
    origin: config.server.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.security.rateLimit.windowMs,
    max: config.security.rateLimit.max,
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

// Session configuration
app.use(session(config.session));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        logger.logRequest(req, res, responseTime);
    });
    
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// Error handling middleware
app.use(handleAuthError);
app.use(errorHandler);
app.use(notFoundHandler);


// Unhandled promise rejection handling
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', { reason, promise });
});

// Uncaught exception handling
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize hybrid database
        await database.initialize();
        
        // Start server
        const server = app.listen(config.server.port, () => {
            logger.info('Server started successfully', {
                port: config.server.port,
                environment: config.server.nodeEnv,
                version: config.api.version
            });
            
            console.log(`🚀 Server running on port ${config.server.port}`);
            console.log(`🌍 Environment: ${config.server.nodeEnv}`);
            console.log(`📖 API Version: ${config.api.version}`);
            console.log(`🔗 Visit http://localhost:${config.server.port} to get started`);
            
            // Log system statistics
            database.getStats().then(stats => {
                logger.info('System initialized', stats);
            });
        });

        // Graceful shutdown handling
        const gracefulShutdown = async (signal) => {
            logger.info(`${signal} received, shutting down gracefully`);
            
            server.close(async () => {
                await database.shutdown();
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

// Start the server
startServer();

// Export app for testing
module.exports = app;
