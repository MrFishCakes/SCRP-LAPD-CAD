# SCRP-LAPD-CAD

A web application that integrates with SonoranCAD API and uses Discord OAuth for authentication with server and role verification.

## Features

- 🔐 **Discord OAuth Authentication** - Secure login with Discord account
- 🛡️ **Server & Role Verification** - Ensures users are members of specific Discord server with required roles
- 🚔 **SonoranCAD API Integration** - Full integration with SonoranCAD API endpoints
- 📱 **LAPD-Style Interface** - Professional law enforcement themed UI
- 🔄 **Real-time CAD Data** - Live data from SonoranCAD system
- 🍪 **Cookie-Based Sessions** - Simple 7-day authentication with 12-hour warning
- 💾 **Persistent User Storage** - SQLite database with Redis caching
- 🔒 **Enhanced Security** - Rate limiting and secure cookie handling

## Prerequisites

- **Node.js** - Version 16 or higher
- **Discord Application** - For OAuth authentication
- **SonoranCAD Account** - With API access
- **Redis** (optional) - For caching (falls back to SQLite only)

## Quick Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run setup script**
   ```bash
   npm run setup
   ```

3. **Configure environment** (see Configuration section)

4. **Start the application**
   ```bash
   npm run dev
   ```

5. **Visit** `http://localhost:3000`

## Configuration

### 1. Discord OAuth Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 → General
4. Add redirect URI: `http://localhost:3000/auth/discord/callback`
5. Copy Client ID and Client Secret

### 2. Discord Server Setup

1. Enable Developer Mode in Discord
2. Right-click your server → Copy Server ID
3. Right-click required role → Copy Role ID

### 3. SonoranCAD API Setup

1. Log into SonoranCAD
2. Go to Settings → API Integration
3. Generate API credentials (API ID, API Key, Community ID)

### 4. Environment Variables

Create `.env` file:

```env
# Discord Configuration
DISCORD_CLIENT_ID=your_discord_client_id # Client ID generated for OAuth
DISCORD_CLIENT_SECRET=your_discord_client_secret # Client secret generated for OAuth
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback # URI to redirect to after OAuth
DISCORD_GUILD_ID=your_discord_server_id # Guild (Server) ID that is required to be authenticated
DISCORD_REQUIRED_ROLE_ID=your_required_role_id # Role required in guild to be authenticated

# Discord Bot Configuration (Optional - for role verification)
DISCORD_BOT_TOKEN=your_discord_bot_token # Bot token to allow role authentication

# SonoranCAD API Configuration
SONORAN_API_KEY=your_sonoran_api_key # API key for community (NOT PERSONAL ONE)
SONORAN_COMMUNITY_ID=your_sonoran_community_id # Community ID

# Session Configuration
SESSION_SECRET=your_session_secret_key # Random string for encrypting cookies

# Server Configuration
PORT=3000 # Port for webserver to run on
NODE_ENV=development # Development or production

# CORS Configuration (Optional - for production)
CORS_ORIGIN=your-production-domain.com

# Logging Configuration (Optional - defaults provided)
LOG_LEVEL=debug
LOG_FORMAT=combined
ENABLE_CONSOLE_LOGGING=true
ENABLE_FILE_LOGGING=false
LOG_FILE=logs/app.log

# Redis Configuration (Optional - for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# SQLite Configuration (Optional - defaults provided)
SQLITE_PATH=./data/database.sqlite
SQLITE_BACKUP_PATH=./data/backups
```

## Usage

### Authentication Flow
1. Visit `http://localhost:3000`
2. Click "Login with Discord"
3. Authorize the application
4. Get redirected to `/hello` (success) or `/no-hello` (failure)

### Cookie System
- **7-day expiry** - Users stay logged in for 7 days
- **12-hour warning** - Re-authentication required when < 12 hours remain
- **Automatic redirect** - Invalid pages redirect to `/hello`

### SonoranCAD API Testing
Visit `/hello` page to test API endpoints:
- **Test Connection** - Verify API connectivity
- **Active Units** - Get all active units
- **Get Calls** - Get all calls with ID and description
- **All Calls** - Get complete call data
- **Active Calls** - Get only active calls
- **Dispatches** - Get dispatch information
- **Call History** - Get historical call data
- **Accounts** - Get account information
- **Map Blips** - Get map data

## Available Scripts

```bash
# Development
npm run dev          # Start with auto-restart
npm start           # Start production server

# Setup & Maintenance
npm run setup       # Initial setup wizard

# Authentication
npm run diagnose    # Check Discord OAuth configuration
npm run bypass-rate-limit  # Temporarily disable Discord verification
npm run test-simple-cookie # Test cookie authentication

# Database
npm run view-users  # View user database
npm run rebuild-db  # Recreate database
npm run fix-db      # Fix database schema issues
npm run test-db     # Test database functionality
```

## Troubleshooting

### Common Issues

1. **Discord OAuth Error**
   ```bash
   npm run diagnose
   ```
   - Check redirect URI matches exactly
   - Verify client ID and secret
   - Ensure Discord app has proper scopes

2. **Rate Limited by Discord**
   ```bash
   npm run bypass-rate-limit
   ```
   - Temporarily disables server/role verification
   - Allows testing without Discord restrictions

3. **Database Issues**
   ```bash
   npm run view-users    # Check user data
   npm run rebuild-db    # Recreate database
   npm run fix-db        # Fix schema issues
   ```

4. **SonoranCAD API Errors**
   - Verify API credentials in `.env`
   - Check community ID matches your SonoranCAD setup
   - Ensure API has proper permissions

## Project Structure

```
SCRP-LAPD-CAD/
├── config/
│   ├── config.js           # Application configuration
│   └── hybrid-database.js  # SQLite + Redis database
├── middleware/
│   ├── simple-auth.js      # Cookie authentication
│   └── error.js            # Error handling
├── routes/
│   ├── auth.js             # Discord OAuth routes
│   ├── api.js              # SonoranCAD API routes
│   └── web.js              # Web interface routes
├── lib/
│   └── sonoran-api/        # SonoranCAD API integration
│       ├── client.js        # HTTP client
│       ├── endpoints.js     # API endpoints
│       ├── request.js       # Request handler
│       └── sonoran-api.js   # Main API class
├── public/
│   ├── index.html          # Login page
│   ├── hello.html          # Success page
│   └── no-hello.html       # Failure page
├── scripts/
│   ├── setup.js            # Setup wizard
│   ├── auth/               # Authentication scripts
│   │   ├── diagnose-discord.js
│   │   ├── bypass-rate-limit.js
│   │   └── test-simple-cookie.js
│   ├── database/           # Database scripts
│   │   ├── view-users.js
│   │   ├── rebuild-database.js
│   │   ├── fix-database-schema.js
│   │   └── test-hybrid-db.js
│   └── docs/               # Documentation
│       ├── fix-discord-oauth.md
│       └── setup-redis.md
├── server.js               # Main server
├── package.json            # Dependencies
└── env.example             # Environment template
```

## Database Schema

**Users Table:**
- `discord_id` (TEXT PRIMARY KEY) - Discord user ID
- `username` (TEXT) - Discord username
- `created_at` (INTEGER) - Epoch timestamp
- `expiry_time` (INTEGER) - Epoch timestamp (7 days from creation)

## Security Features

- **Cookie-based Authentication** - Simple 7-day sessions
- **Discord OAuth** - Secure login through Discord
- **Server/Role Verification** - Optional Discord server membership
- **Rate Limiting** - Prevents API abuse
- **Input Validation** - Secure data handling
- **CORS Protection** - Configurable cross-origin settings
