/**
 * Application configuration management
 * Centralizes all configuration logic and validation
 */

require('dotenv').config();

class Config {
    constructor() {
        this.validateRequiredEnvVars();
    }

    // Discord OAuth Configuration
    get discord() {
        return {
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
            guildId: process.env.DISCORD_GUILD_ID,
            requiredRoleId: process.env.DISCORD_REQUIRED_ROLE_ID,
            botToken: process.env.DISCORD_BOT_TOKEN // Optional, for role verification
        };
    }

    // SonoranCAD API Configuration
    get sonoran() {
        return {
            apiId: process.env.SONORAN_API_ID,
            apiKey: process.env.SONORAN_API_KEY,
            communityId: process.env.SONORAN_COMMUNITY_ID,
            baseUrl: 'https://api.sonoransoftware.com',
            timeout: 10000
        };
    }

    // Session Configuration
    get session() {
        return {
            secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                httpOnly: true,
                sameSite: 'lax'
            }
        };
    }

    // Server Configuration
    get server() {
        return {
            port: parseInt(process.env.PORT) || 3000,
            nodeEnv: process.env.NODE_ENV || 'development',
            corsOrigin: process.env.NODE_ENV === 'production' 
                ? process.env.CORS_ORIGIN || 'your-production-domain.com'
                : 'http://localhost:3000'
        };
    }

    // Security Configuration
    get security() {
        return {
            rateLimit: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100 // limit each IP to 100 requests per windowMs
            },
            helmet: {
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        scriptSrc: ["'self'"],
                        imgSrc: ["'self'", "data:", "https:"],
                        connectSrc: ["'self'", "https://discord.com", "https://api.sonoransoftware.com"]
                    }
                }
            }
        };
    }

    // API Configuration
    get api() {
        return {
            version: '1.0.0',
            basePath: '/api',
            timeout: 10000,
            retryAttempts: 3,
            retryDelay: 1000
        };
    }

    // Logging Configuration
    get logging() {
        return {
            level: process.env.LOG_LEVEL || (this.server.nodeEnv === 'production' ? 'info' : 'debug'),
            format: process.env.LOG_FORMAT || 'combined',
            enableConsole: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
            enableFile: process.env.ENABLE_FILE_LOGGING === 'true',
            logFile: process.env.LOG_FILE || 'logs/app.log'
        };
    }

    // Validation
    validateRequiredEnvVars() {
        const required = [
            'DISCORD_CLIENT_ID',
            'DISCORD_CLIENT_SECRET',
            'SONORAN_API_ID',
            'SONORAN_API_KEY',
            'SONORAN_COMMUNITY_ID'
        ];

        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            console.error('❌ Missing required environment variables:');
            missing.forEach(key => console.error(`   - ${key}`));
            console.error('\nPlease check your .env file and ensure all required variables are set.');
            process.exit(1);
        }

        // Warn about optional but recommended variables
        const recommended = [
            'DISCORD_GUILD_ID',
            'DISCORD_REQUIRED_ROLE_ID',
            'SESSION_SECRET'
        ];

        const missingRecommended = recommended.filter(key => !process.env[key]);
        if (missingRecommended.length > 0) {
            console.warn('⚠️  Missing recommended environment variables:');
            missingRecommended.forEach(key => console.warn(`   - ${key}`));
            console.warn('These are recommended for production use.\n');
        }
    }

    // Get all configuration as object
    getAll() {
        return {
            discord: this.discord,
            sonoran: this.sonoran,
            session: this.session,
            server: this.server,
            security: this.security,
            api: this.api,
            logging: this.logging
        };
    }

    // Check if running in production
    isProduction() {
        return this.server.nodeEnv === 'production';
    }

    // Check if running in development
    isDevelopment() {
        return this.server.nodeEnv === 'development';
    }
}

module.exports = new Config();

