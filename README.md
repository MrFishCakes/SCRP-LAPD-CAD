# SCRP LAPD CAD System

A complete Computer-Aided Dispatch (CAD) system integrating FiveM with a modern web application for the SCRP LAPD roleplay server.

## 🚀 Features

### Web Application
- **Discord OAuth Authentication** - Secure login with Discord accounts
- **Admin Panel** - User management, session tracking, and analytics
- **Real-time Call Management** - Live 911 call tracking and dispatch
- **Session Management** - Secure cookie-based authentication with Redis caching
- **API Integration** - SonoranCAD webhook integration for real-time updates
- **Performance Analytics** - Detailed statistics and monitoring

### FiveM Integration
- **SonoranCAD Integration** - Automatic call detection and forwarding
- **Real-time Webhooks** - Instant communication with web application
- **Call Management** - Complete call lifecycle tracking
- **Unit Assignment** - Dispatch and unit status management
- **Health Monitoring** - Automatic connection monitoring and retry logic

## 📁 Project Structure

```
SCRP-LAPD-CAD/
├── 📁 web-app/                    # Node.js Web Application
│   ├── 📁 config/                 # Configuration files
│   ├── 📁 routes/                 # Express routes
│   ├── 📁 middleware/             # Authentication & error handling
│   ├── 📁 views/                  # EJS templates
│   ├── 📁 lib/                    # Utility libraries
│   ├── 📁 scripts/                # Database & testing scripts
│   ├── 📁 data/                   # SQLite database
│   ├── 📁 public/                 # Static assets
│   ├── server.js                  # Main server file
│   └── package.json               # Web app dependencies
├── 📁 fivem-script/               # FiveM Lua Resource
│   ├── 📁 client/                 # Client-side Lua scripts
│   ├── 📁 server/                 # Server-side Lua scripts
│   ├── 📁 shared/                 # Shared configuration
│   ├── fxmanifest.lua             # FiveM resource manifest
│   └── README.md                  # FiveM script documentation
├── 📁 docs/                       # Documentation
│   ├── setup.md                   # Complete setup guide
│   ├── web-app-setup.md           # Web app setup
│   ├── fivem-setup.md             # FiveM setup
│   └── integration.md             # Integration guide
├── package.json                   # Root package.json
└── README.md                      # This file
```

## 🛠️ Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Redis** server
- **FiveM Server** with SonoranCAD
- **Discord Application** for OAuth

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/scrp-lapd-cad-system.git
   cd scrp-lapd-cad-system
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Configure environment**
   ```bash
   cd web-app
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the web application**
   ```bash
   npm start
   ```

5. **Install FiveM script**
   - Copy `fivem-script/` to your FiveM `resources/` folder
   - Add to `server.cfg`: `ensure scrp-lapd-cad`
   - Configure server variables

## ⚙️ Configuration

### Web Application (.env)
```env
# Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Security
COOKIE_SECRET=your_cookie_secret
SESSION_SECRET=your_session_secret

# Database
REDIS_URL=redis://localhost:6379

# Server
PORT=3000
NODE_ENV=development
```

### FiveM Server (server.cfg)
```cfg
# CAD Web App Integration
set cad_webapp_url "http://your-web-app:3000"
set cad_api_key "your-api-key"
```

## 🔧 Available Scripts

### Root Level
- `npm start` - Start web application
- `npm run dev` - Start web application in development mode
- `npm run install-all` - Install all dependencies
- `npm test` - Run tests

### Web Application
- `npm run diagnose` - Diagnose Discord OAuth issues
- `npm run test-analytics` - Test analytics functionality
- `npm run create-sessions` - Create sessions for existing users
- `npm run manage-admin` - Manage admin access
- `npm run rebuild-db` - Rebuild database

## 📊 Features Overview

### Authentication System
- **Discord OAuth** - Secure authentication via Discord
- **Signed Cookies** - Cryptographically secure session management
- **Session Tracking** - Detailed user session monitoring
- **Admin Access** - Role-based access control

### Call Management
- **Real-time Updates** - Instant call notifications
- **Priority Queuing** - Automatic priority-based call sorting
- **Unit Assignment** - Dispatch and unit management
- **Call History** - Complete call lifecycle tracking

### Analytics & Monitoring
- **User Statistics** - Active users, session data
- **API Performance** - Response times, call volumes
- **System Health** - Redis connectivity, database status
- **Real-time Dashboard** - Live system monitoring

## 🔗 Integration Flow

```
SonoranCAD → FiveM Script → Web App → Admin Panel
     ↓            ↓           ↓          ↓
  911 Call    Webhook     Redis     Real-time
  Created     HTTP POST   Storage   Updates
```

## 📚 Documentation

- **[Complete Setup Guide](docs/setup.md)** - Full installation and configuration
- **[Web App Setup](docs/web-app-setup.md)** - Web application specific setup
- **[FiveM Setup](docs/fivem-setup.md)** - FiveM script installation
- **[Integration Guide](docs/integration.md)** - Connecting all components

## 🚨 Troubleshooting

### Common Issues

1. **Discord OAuth not working**
   ```bash
   npm run diagnose
   npm run fix-discord-oauth
   ```

2. **Database connection issues**
   ```bash
   npm run test-db
   npm run fix-db
   ```

3. **Session tracking problems**
   ```bash
   npm run create-sessions
   npm run test-analytics
   ```

### Debug Mode

Enable debug logging:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/scrp-lapd-cad-system/issues)
- **Documentation**: [Wiki](https://github.com/your-org/scrp-lapd-cad-system/wiki)
- **Discord**: [SCRP LAPD Discord](https://discord.gg/your-discord)

## 🏆 Credits

- **SCRP LAPD Development Team** - Main development
- **SonoranCAD** - CAD system integration
- **FiveM Community** - Platform and support

---

**Built with ❤️ for the SCRP LAPD Roleplay Community**