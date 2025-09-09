# Discord OAuth Fix Guide

## Current Issue
The Discord OAuth is failing with "Failed to fetch Discord guilds" error. This is typically caused by missing OAuth scopes or incorrect application configuration.

## Step-by-Step Fix

### 1. Discord Developer Portal Configuration

1. **Go to Discord Developer Portal**
   - Visit: https://discord.com/developers/applications
   - Select your application

2. **Configure OAuth2 Settings**
   - Go to **OAuth2** → **General**
   - **Client ID**: Copy this to your `.env` file as `DISCORD_CLIENT_ID`
   - **Client Secret**: Copy this to your `.env` file as `DISCORD_CLIENT_SECRET`

3. **Add Redirect URI**
   - In **OAuth2** → **General** → **Redirects**
   - Add: `http://localhost:3000/auth/discord/callback`
   - Click **Save Changes**

4. **Configure OAuth2 Scopes**
   - Go to **OAuth2** → **URL Generator**
   - **Scopes**: Select these scopes:
     - ✅ `identify` (required for basic user info)
     - ✅ `guilds` (required for server membership check)
   - **URL**: Copy the generated URL for testing

### 2. Bot Configuration (Optional - for role verification)

1. **Create Bot**
   - Go to **Bot** section
   - Click **Add Bot**
   - **Token**: Copy this to your `.env` file as `DISCORD_BOT_TOKEN`

2. **Bot Permissions**
   - **Server Members Intent**: Enable this
   - **Read Messages**: Enable this
   - **View Channels**: Enable this

3. **Invite Bot to Server**
   - Go to **OAuth2** → **URL Generator**
   - **Scopes**: Select `bot`
   - **Bot Permissions**: Select:
     - Read Messages
     - View Channels
     - Read Message History
   - Use the generated URL to invite bot to your server

### 3. Environment Variables

Update your `.env` file with these values:

```env
# Discord OAuth Configuration
DISCORD_CLIENT_ID=your_actual_client_id_here
DISCORD_CLIENT_SECRET=your_actual_client_secret_here
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Discord Server Configuration (optional)
DISCORD_GUILD_ID=your_discord_server_id_here
DISCORD_REQUIRED_ROLE_ID=your_required_role_id_here

# Discord Bot Token (optional - for role verification)
DISCORD_BOT_TOKEN=your_bot_token_here
```

### 4. Testing Without Server Verification

If you want to test without server verification, you can temporarily remove the guild ID:

```env
# Comment out or remove these lines for testing
# DISCORD_GUILD_ID=your_discord_server_id_here
# DISCORD_REQUIRED_ROLE_ID=your_required_role_id_here
```

### 5. Common Issues and Solutions

#### Issue: "Failed to fetch Discord guilds"
**Solution**: 
- Ensure `guilds` scope is selected in OAuth2 settings
- Check that redirect URI is exactly: `http://localhost:3000/auth/discord/callback`

#### Issue: "User is not a member of the required Discord server"
**Solution**:
- Verify `DISCORD_GUILD_ID` is correct
- Make sure the user is actually in that Discord server
- Temporarily remove `DISCORD_GUILD_ID` to test without server verification

#### Issue: "Invalid client secret"
**Solution**:
- Double-check the client secret in Discord Developer Portal
- Ensure no extra spaces or characters in `.env` file

### 6. Testing Steps

1. **Update your `.env` file** with correct values
2. **Restart the application**: `npm start`
3. **Test OAuth flow**: Visit `http://localhost:3000`
4. **Click "Login with Discord"**
5. **Complete Discord authorization**
6. **Check for success**: You should see the "Temporary CAD Screen"

### 7. Debug Commands

```bash
# Check configuration
npm run diagnose

# Run setup script
npm run setup

# Start application
npm start
```

## Quick Test Mode

To quickly test the application without Discord server verification:

1. **Comment out these lines in your `.env` file**:
   ```env
   # DISCORD_GUILD_ID=your_discord_server_id_here
   # DISCORD_REQUIRED_ROLE_ID=your_required_role_id_here
   ```

2. **Restart the application**
3. **Test the OAuth flow**

This will allow any Discord user to authenticate without checking server membership.

