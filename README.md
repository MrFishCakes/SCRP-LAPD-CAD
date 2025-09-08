# SonoranCAD Web Application

A web application that integrates with SonoranCAD API and uses Discord OAuth for authentication with server and role verification.

## Features

- 🔐 **Discord OAuth Authentication** - Secure login with Discord account
- 🛡️ **Server & Role Verification** - Ensures users are members of specific Discord server with required roles
- 🚔 **SonoranCAD API Integration** - Full integration with SonoranCAD API endpoints
- 📱 **Modern Web Interface** - Responsive, user-friendly interface
- 🔄 **Real-time Updates** - Live data from SonoranCAD system
- 🔑 **JWT Token Authentication** - Secure, persistent authentication with refresh tokens
- 💾 **Persistent Sessions** - Users stay logged in across browser sessions
- 🔒 **Enhanced Security** - Rate limiting, input validation, and secure token storage

## Prerequisites

Before setting up the application, you'll need:

1. **Discord Application** - Create a Discord application for OAuth
2. **SonoranCAD Account** - Active SonoranCAD subscription with API access
3. **Node.js** - Version 16 or higher
4. **Discord Bot Token** (optional) - For role verification

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd sonoran-cad-web-app
   ```

2. **Run the setup script**
   ```bash
   npm run setup
   ```
   This will:
   - Create your `.env` file from the template
   - Generate a secure session secret
   - Create necessary directories
   - Validate your configuration

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Configure your `.env` file** (see Configuration section below)

5. **Start the application**
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## Configuration

### Discord OAuth Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 section
4. Add redirect URI: `http://localhost:3000/auth/discord/callback`
5. Copy Client ID and Client Secret to your `.env` file

### Discord Server Configuration

1. Get your Discord server (guild) ID:
   - Enable Developer Mode in Discord
   - Right-click your server → Copy Server ID
2. Get the required role ID:
   - Right-click the role → Copy Role ID
3. Add these to your `.env` file

### SonoranCAD API Setup

1. Log into your SonoranCAD account
2. Go to Settings → API Integration
3. Generate API credentials:
   - API ID
   - API Key
   - Community ID
4. Add these to your `.env` file

### Environment Variables

Create a `.env` file with the following variables:

```env
# Discord OAuth Configuration
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Discord Server Configuration
DISCORD_GUILD_ID=your_discord_server_id
DISCORD_REQUIRED_ROLE_ID=your_required_role_id

# SonoranCAD API Configuration
SONORAN_API_ID=your_sonoran_api_id
SONORAN_API_KEY=your_sonoran_api_key
SONORAN_COMMUNITY_ID=your_sonoran_community_id

# Session Configuration
SESSION_SECRET=your_session_secret_key

# Server Configuration
PORT=3000
NODE_ENV=development
```

## API Endpoints

The application provides the following API endpoints (all require authentication):

### Authentication
- `GET /auth/discord` - Initiate Discord OAuth
- `GET /auth/discord/callback` - Discord OAuth callback
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user info
- `GET /auth/status` - Check authentication status
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/refresh` - Refresh user data from Discord

### SonoranCAD Integration
- `GET /api/test` - Test API connection
- `GET /api/active-units` - Get active units
- `GET /api/calls` - Get all calls/dispatches
- `POST /api/new-dispatch` - Create new dispatch
- `POST /api/new-911` - Create new 911 call
- `POST /api/attach-unit` - Attach unit to call
- `POST /api/detach-unit` - Detach unit from call
- `POST /api/close-dispatch` - Close dispatch call
- `POST /api/add-call-note` - Add note to call
- `POST /api/update-unit-status` - Update unit status
- `POST /api/set-unit-panic` - Set unit panic status
- `POST /api/lookup` - Lookup name or plate

## Usage

1. **Start the application** and navigate to `http://localhost:3000`
2. **Login with Discord** - You'll be redirected to Discord for authentication
3. **Access the dashboard** - Once authenticated, you'll see the main interface
4. **Use SonoranCAD features**:
   - View active calls and units
   - Create new dispatches and 911 calls
   - Manage unit statuses
   - Perform lookups
   - Add call notes

## Security Features

- **Discord OAuth** - Secure authentication through Discord
- **Server Membership Verification** - Ensures users are in the correct Discord server
- **Role-based Access** - Verifies users have the required Discord role
- **JWT Token Authentication** - Secure, stateless authentication with access and refresh tokens
- **Persistent Sessions** - Users stay logged in across browser sessions and page refreshes
- **Token Refresh** - Automatic token renewal to maintain long-term sessions
- **Rate Limiting** - Prevents abuse with configurable request limits
- **Input Validation** - Comprehensive validation of all user inputs
- **Session Management** - Secure session handling with configurable timeouts
- **CORS Protection** - Configurable CORS settings for production
- **Helmet Security** - Security headers and protection
- **Secure Token Storage** - Tokens stored securely with proper expiration handling

## Development

### Project Structure

```
sonoran-cad-web-app/
├── config/
│   ├── config.js           # Application configuration management
│   └── database.js         # Database/in-memory storage management
├── middleware/
│   ├── auth.js             # Authentication middleware
│   └── error.js            # Error handling middleware
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── api.js              # SonoranCAD API routes
│   └── web.js              # Web interface routes
├── utils/
│   ├── logger.js           # Logging utility
│   ├── validators.js       # Input validation utilities
│   └── helpers.js          # General helper functions
├── lib/
│   └── sonoran-api.js      # SonoranCAD API integration
├── public/
│   └── index.html          # Web interface
├── scripts/
│   └── setup.js            # Setup and configuration script
├── server.js               # Main server file
├── package.json            # Dependencies and scripts
├── env.example             # Environment variables template
└── README.md               # This file
```

### Adding New Features

1. **API Endpoints**: Add new routes in `routes/api.js`
2. **Authentication**: Modify `routes/auth.js` for auth changes
3. **SonoranCAD Integration**: Extend the `SonoranAPI` class in `lib/sonoran-api.js`
4. **Frontend**: Modify `public/index.html` for UI changes
5. **Middleware**: Add new middleware in `middleware/` directory
6. **Utilities**: Add helper functions in `utils/` directory
7. **Configuration**: Update `config/config.js` for new settings

## Troubleshooting

### Common Issues

1. **Discord OAuth not working**
   - Check redirect URI matches exactly
   - Verify client ID and secret are correct
   - Ensure Discord application is properly configured

2. **Role verification failing**
   - Verify guild ID and role ID are correct
   - Check if bot has permission to read member roles
   - Ensure user has the required role

3. **SonoranCAD API errors**
   - Verify API credentials are correct
   - Check if API ID has proper permissions
   - Ensure community ID matches your SonoranCAD community

4. **Session issues**
   - Check SESSION_SECRET is set
   - Verify cookie settings for production
   - Clear browser cookies if needed

### Debug Mode

Set `NODE_ENV=development` in your `.env` file for detailed error messages and logging.

## Production Deployment

1. **Set production environment variables**
2. **Update CORS origin** to your production domain
3. **Use HTTPS** for secure cookie transmission
4. **Set secure session secret**
5. **Configure reverse proxy** (nginx/Apache) if needed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support with this application:
- Check the troubleshooting section above
- Review SonoranCAD API documentation
- Check Discord OAuth documentation

For SonoranCAD-specific issues, contact SonoranCAD support.
