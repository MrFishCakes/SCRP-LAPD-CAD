/**
 * Core Type Definitions for SCRP-LAPD-CAD
 */

// =============================================================================
// SonoranCAD API Types
// =============================================================================

export interface SonoranCall {
  id: string;
  callId?: string;
  priority: number;
  location: string;
  description: string;
  origin: number;
  createdAt: string;
  updatedAt?: string;
  status: string;
  units?: string[];
  [key: string]: any; // Allow additional properties
}

export interface SonoranAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface SonoranCallsResponse {
  activeCalls: SonoranCall[];
  closedCalls?: SonoranCall[];
}

// =============================================================================
// User & Authentication Types
// =============================================================================

export interface UserProfile {
  discordId: string;
  sonoranUuid?: string;
  callsign?: string;
  name?: string;
  rank?: string;
  username?: string;
  createdAt?: string;
}

export interface DiscordProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  guilds?: DiscordGuild[];
}

export interface DiscordGuild {
  id: string;
  name: string;
  roles: DiscordRole[];
}

export interface DiscordRole {
  id: string;
  name: string;
  permissions: string;
}

// =============================================================================
// Database Types
// =============================================================================

export interface DatabaseConfig {
  redis: RedisConfig;
  sqlite: SQLiteConfig;
  cache: CacheConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string | undefined;
  db: number;
  retryDelayOnFailover: number;
}

export interface SQLiteConfig {
  path: string;
  backupPath: string;
  backupInterval: number;
  maxBackups: number;
}

export interface CacheConfig {
  userTTL: number;
  sessionTTL: number;
  refreshTokenTTL: number;
}

export interface UserData {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  sonoranUuid?: string | null;
  callsign?: string | null;
  name?: string | null;
  rank?: string | null;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
}

export interface SessionData {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface AppConfig {
  discord: DiscordConfig;
  sonoran: SonoranConfig;
  server: ServerConfig;
  session: SessionConfig;
  cors: CorsConfig;
  security: SecurityConfig;
}

export interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  guildId?: string | undefined;
  requiredRoleId?: string | undefined;
  botToken?: string | undefined;
}

export interface SonoranConfig {
  apiKey: string;
  communityId: string;
  baseUrl: string;
  timeout: number;
  webhookSecret?: string | undefined;
  serverId: number;
}

export interface ServerConfig {
  port: number;
  environment: string;
  corsOrigin: string;
}

export interface SessionConfig {
  secret: string;
  resave: boolean;
  saveUninitialized: boolean;
  cookie: SessionCookieConfig;
}

export interface SessionCookieConfig {
  secure: boolean;
  httpOnly: boolean;
  maxAge: number;
  sameSite: 'strict' | 'lax' | 'none';
}

export interface CorsConfig {
  origin: string;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

export interface SecurityConfig {
  rateLimit: RateLimitConfig;
  csp: CSPConfig;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface CSPConfig {
  directives: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
  };
}

// =============================================================================
// WebSocket Types
// =============================================================================

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface CallUpdateMessage extends WebSocketMessage {
  type: 'new_call' | 'call_update' | 'call_closed';
  data: {
    call: SonoranCall;
  };
}

// =============================================================================
// API Response Types
// =============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface CallsResponse extends APIResponse {
  data: {
    calls: SonoranCall[];
    count: number;
  };
}

export interface UserResponse extends APIResponse {
  data: UserProfile;
}

// =============================================================================
// Environment Variables
// =============================================================================

export interface EnvironmentVariables {
  // Discord Configuration
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  DISCORD_GUILD_ID?: string;
  DISCORD_REQUIRED_ROLE_ID?: string;
  DISCORD_BOT_TOKEN?: string;

  // SonoranCAD Configuration
  SONORAN_API_KEY: string;
  SONORAN_COMMUNITY_ID: string;
  SONORAN_WEBHOOK_SECRET?: string;
  SONORAN_SERVER_ID?: string;

  // Server Configuration
  PORT?: string;
  NODE_ENV?: string;
  CORS_ORIGIN?: string;

  // Security Configuration
  SESSION_SECRET: string;
  COOKIE_SECRET?: string;
  SESSION_COOKIE_MAX_AGE?: string;
  SESSION_COOKIE_SECURE?: string;
  SESSION_COOKIE_HTTP_ONLY?: string;
  SESSION_COOKIE_SAME_SITE?: string;

  // Database Configuration
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  REDIS_DB?: string;
  SQLITE_PATH?: string;
  SQLITE_BACKUP_PATH?: string;

  // Logging Configuration
  LOG_LEVEL?: string;
  LOG_FORMAT?: string;
  ENABLE_CONSOLE_LOGGING?: string;
  ENABLE_FILE_LOGGING?: string;
  LOG_FILE?: string;

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
export type Environment = 'development' | 'production' | 'test';

export interface Logger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface Database {
  getUser(discordId: string): Promise<UserData | null>;
  setCache(key: string, value: any, ttl?: number): Promise<void>;
  getFromCache(key: string): Promise<any>;
  deleteFromCache(key: string): Promise<void>;
  getActiveCalls(limit?: number): Promise<SonoranCall[]>;
  zAdd(key: string, score: number, member: string): Promise<void>;
  zRem(key: string, member: string): Promise<void>;
  zRevRange(key: string, start: number, stop: number): Promise<string[]>;
}
