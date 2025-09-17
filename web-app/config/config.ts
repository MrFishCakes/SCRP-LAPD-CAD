/**
 * Application configuration management
 * Centralizes all configuration logic and validation
 */

import 'dotenv/config';
import { 
  DiscordConfig, 
  SonoranConfig, 
  SessionConfig, 
  ServerConfig, 
  SecurityConfig,
  LogLevel,
  Environment 
} from '../types';

interface APIConfig {
  version: string;
  basePath: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface LoggingConfig {
  level: LogLevel;
  format: string;
  enableConsole: boolean;
  enableFile: boolean;
  logFile: string;
}

class Config {
  constructor() {
    this.validateRequiredEnvVars();
  }

  // Discord OAuth Configuration
  get discord(): DiscordConfig {
    return {
      clientId: process.env['DISCORD_CLIENT_ID']!,
      clientSecret: process.env['DISCORD_CLIENT_SECRET']!,
      redirectUri: process.env['DISCORD_REDIRECT_URI'] || 'http://localhost:3000/auth/discord/callback',
      guildId: process.env['DISCORD_GUILD_ID'] || undefined,
      requiredRoleId: process.env['DISCORD_REQUIRED_ROLE_ID'] || undefined,
      botToken: process.env['DISCORD_BOT_TOKEN'] || undefined
    };
  }

  // SonoranCAD API Configuration
  get sonoran(): SonoranConfig {
    return {
      apiKey: process.env['SONORAN_API_KEY']!,
      communityId: process.env['SONORAN_COMMUNITY_ID']!,
      baseUrl: 'https://api.sonoransoftware.com',
      timeout: 10000,
      webhookSecret: process.env['SONORAN_WEBHOOK_SECRET'] || undefined,
      serverId: parseInt(process.env['SONORAN_SERVER_ID'] || '1')
    };
  }

  // Session Configuration
  get session(): SessionConfig {
    return {
      secret: process.env['SESSION_SECRET'] || 'fallback-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env['SESSION_COOKIE_SECURE'] === 'true' || process.env['NODE_ENV'] === 'production',
        httpOnly: process.env['SESSION_COOKIE_HTTP_ONLY'] !== 'false',
        maxAge: parseInt(process.env['SESSION_COOKIE_MAX_AGE'] || '86400000'), // 24 hours default
        sameSite: (process.env['SESSION_COOKIE_SAME_SITE'] as 'strict' | 'lax' | 'none') || 'strict'
      }
    };
  }

  // Server Configuration
  get server(): ServerConfig {
    return {
      port: parseInt(process.env['PORT'] || '3000'),
      environment: (process.env['NODE_ENV'] as Environment) || 'development',
      corsOrigin: process.env['NODE_ENV'] === 'production' 
        ? process.env['CORS_ORIGIN'] || 'your-production-domain.com'
        : 'http://localhost:3000'
    };
  }

  // Security Configuration
  get security(): SecurityConfig {
    return {
      rateLimit: {
        windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes default
        maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100')
      },
      csp: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://discord.com", "https://api.sonoransoftware.com"]
        }
      }
    };
  }

  // API Configuration
  get api(): APIConfig {
    return {
      version: '1.0.0',
      basePath: '/api',
      timeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000
    };
  }

  // Logging Configuration
  get logging(): LoggingConfig {
    return {
      level: (process.env['LOG_LEVEL'] as LogLevel) || (this.server.environment === 'production' ? 'info' : 'debug'),
      format: process.env['LOG_FORMAT'] || 'combined',
      enableConsole: process.env['ENABLE_CONSOLE_LOGGING'] !== 'false',
      enableFile: process.env['ENABLE_FILE_LOGGING'] === 'true',
      logFile: process.env['LOG_FILE'] || 'logs/app.log'
    };
  }

  // Validation
  private validateRequiredEnvVars(): void {
    const required = [
      'DISCORD_CLIENT_ID',
      'DISCORD_CLIENT_SECRET',
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
  getAll(): any {
    return {
      discord: this.discord,
      sonoran: this.sonoran,
      session: this.session,
      server: this.server,
      security: this.security,
      cors: {
        origin: this.server.corsOrigin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      }
    };
  }

  // Check if running in production
  isProduction(): boolean {
    return this.server.environment === 'production';
  }

  // Check if running in development
  isDevelopment(): boolean {
    return this.server.environment === 'development';
  }
}

export default new Config();
