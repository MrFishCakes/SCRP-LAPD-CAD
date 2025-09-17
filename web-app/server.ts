/**
 * SonoranCAD Web Application
 * Main server file with simple cookie-based authentication
 */

import express, { Application } from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';

// Import configuration and utilities
import logger from './utils/logger';
import database from './config/hybrid-database';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/error';

// Import routes
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import webRoutes from './routes/web';
import sonoranRoutes from './routes/sonoran';

// Import WebSocket server
import WebSocketServer from './lib/websocket-server';

// Import RabbitMQ services
import callPublisher from './lib/call-publisher';
import callConsumer from './lib/call-consumer';

const app: Application = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: process.env['SESSION_SECRET'] || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env['SESSION_COOKIE_SECURE'] === 'true' || process.env['NODE_ENV'] === 'production',
        httpOnly: process.env['SESSION_COOKIE_HTTP_ONLY'] !== 'false', // Default true
        maxAge: parseInt(process.env['SESSION_COOKIE_MAX_AGE'] || '86400000'), // 24 hours default
        sameSite: (process.env['SESSION_COOKIE_SAME_SITE'] as 'strict' | 'lax' | 'none') || 'strict'
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/sonoran', sonoranRoutes);
app.use('/', webRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);

// Start server
const PORT = parseInt(process.env['PORT'] || '3000');
const HOST = process.env['HOST'] || 'localhost';

async function startServer(): Promise<void> {
    try {
        // Initialize database
        await database.initialize();
        logger.info('Database initialized successfully');

        // Start RabbitMQ services
        await callPublisher.start();
        await callConsumer.start();
        logger.info('RabbitMQ services started');

        // Start HTTP server
        server.listen(PORT, HOST, () => {
            logger.info(`🚀 Server running on http://${HOST}:${PORT}`, {
                environment: process.env['NODE_ENV'] || 'development',
                port: PORT,
                host: HOST,
                websocket: true,
                rabbitMQ: true
            });

            // Log configuration summary
            logger.info('Configuration Summary:', {
                corsOrigin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
                sessionSecret: process.env['SESSION_SECRET'] ? '***configured***' : 'fallback-secret-key',
                sonoranAPI: process.env['SONORAN_API_KEY'] ? '***configured***' : 'not configured',
                sonoranCommunity: process.env['SONORAN_COMMUNITY_ID'] || 'not configured',
                discordClient: process.env['DISCORD_CLIENT_ID'] ? '***configured***' : 'not configured',
                discordBot: process.env['DISCORD_BOT_TOKEN'] ? '***configured***' : 'not configured',
                redisUrl: process.env['REDIS_URL'] || 'not configured',
                sqlitePath: process.env['SQLITE_PATH'] || './data/database.sqlite'
            });
        });

        // Graceful shutdown
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

    } catch (error: any) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

async function gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
        // Stop RabbitMQ services
        callPublisher.stop();
        callConsumer.stop();
        logger.info('RabbitMQ services stopped');

        // Close WebSocket server
        wsServer.close();
        logger.info('WebSocket server closed');

        // Close HTTP server
        server.close(() => {
            logger.info('HTTP server closed');
        });

        // Close database connections
        await database.close();
        logger.info('Database connections closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error: any) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', { reason: reason });
    process.exit(1);
});

// Start the server
startServer();
