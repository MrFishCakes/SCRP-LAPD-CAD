/**
 * Authentication routes
 * Handles Discord OAuth authentication flow
 */

const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const config = require('../config/config');
const database = require('../config/database');
const jwtAuth = require('../lib/jwt-auth');
const { asyncHandler, AuthenticationError, ExternalServiceError } = require('../middleware/error');

const router = express.Router();

/**
 * Configure Discord OAuth Strategy
 */
passport.use(new DiscordStrategy({
    clientID: config.discord.clientId,
    clientSecret: config.discord.clientSecret,
    callbackURL: config.discord.redirectUri,
    scope: ['identify', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user is in the required Discord server
        const guildId = config.discord.guildId;
        const requiredRoleId = config.discord.requiredRoleId;
        
        // Fetch user's guilds to verify server membership
        let guilds = [];
        
        try {
            const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!guildsResponse.ok) {
                const errorText = await guildsResponse.text();
                console.error('Discord API Error:', {
                    status: guildsResponse.status,
                    statusText: guildsResponse.statusText,
                    body: errorText,
                    url: guildsResponse.url
                });
                
                // If guilds fetch fails but no specific guild is required, allow authentication
                if (!guildId) {
                    console.log('Guilds fetch failed but no specific server required, allowing authentication');
                } else {
                    throw new AuthenticationError(`Failed to fetch Discord guilds: ${guildsResponse.status} ${guildsResponse.statusText}`);
                }
            } else {
                guilds = await guildsResponse.json();
            }
        } catch (error) {
            // If guilds fetch fails due to network issues, but no specific guild is required, allow authentication
            if (!guildId) {
                console.log('Guilds fetch failed due to network error but no specific server required, allowing authentication');
            } else {
                throw error;
            }
        }
        
        // If no specific guild is required, allow authentication
        if (!guildId) {
            console.log('No specific Discord server required, allowing authentication');
        } else {
            const targetGuild = guilds.find(guild => guild.id === guildId);
            
            if (!targetGuild) {
                console.log('User guilds:', guilds.map(g => ({ id: g.id, name: g.name })));
                throw new AuthenticationError(`User is not a member of the required Discord server (${guildId})`);
            }
        }
        
        // Check if user has the required role (if specified)
        if (requiredRoleId && config.discord.botToken) {
            try {
                const memberResponse = await fetch(`https://discord.com/api/guilds/${guildId}/members/${profile.id}`, {
                    headers: {
                        'Authorization': `Bot ${config.discord.botToken}`
                    }
                });
                
                if (memberResponse.ok) {
                    const member = await memberResponse.json();
                    const hasRequiredRole = member.roles.includes(requiredRoleId);
                    
                    if (!hasRequiredRole) {
                        throw new AuthenticationError('User does not have the required role');
                    }
                }
            } catch (error) {
                console.warn('Could not verify user role:', error.message);
                // Continue without role verification if bot token is not available
            }
        }
        
        // Store user data in session
        const user = {
            id: profile.id,
            username: profile.username,
            discriminator: profile.discriminator,
            avatar: profile.avatar,
            guildId: guildId,
            accessToken: accessToken,
            roles: [] // Will be populated if role verification is successful
        };
        
        // Save user to database
        database.saveUser(profile.id, user);
        
        return done(null, user);
    } catch (error) {
        console.error('Discord OAuth error:', error);
        return done(error, null);
    }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

/**
 * Routes
 */

// Initiate Discord OAuth
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth callback
router.get('/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/auth/failed' }),
    asyncHandler(async (req, res) => {
        // Store successful login
        database.saveUser(req.user.id, req.user);
        
        // Generate JWT tokens
        const tokens = jwtAuth.generateTokenPair(req.user);
        
        // Store tokens in session for web interface
        req.session.tokens = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn
        };
        
        // Redirect to original URL or dashboard
        const returnTo = req.session.returnTo || '/dashboard';
        delete req.session.returnTo;
        res.redirect(returnTo);
    })
);

// Login failed page
router.get('/failed', (req, res) => {
    res.status(401).json({
        success: false,
        error: {
            message: 'Authentication failed',
            details: 'You must be a member of the required Discord server and have the appropriate role.',
            statusCode: 401
        }
    });
});

// Logout
router.post('/logout', (req, res) => {
    // Revoke refresh token if user is authenticated
    if (req.user && req.user.id) {
        jwtAuth.revokeAllUserTokens(req.user.id);
    }
    
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({
                success: false,
                error: {
                    message: 'Logout failed',
                    statusCode: 500
                }
            });
        }
        
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
                return res.status(500).json({
                    success: false,
                    error: {
                        message: 'Session cleanup failed',
                        statusCode: 500
                    }
                });
            }
            
            res.clearCookie('connect.sid');
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    });
});

// Get current user info
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        const response = {
            success: true,
            user: {
                id: req.user.id,
                username: req.user.username,
                discriminator: req.user.discriminator,
                avatar: req.user.avatar,
                guildId: req.user.guildId,
                isAuthenticated: true
            }
        };
        
        // Include tokens if available in session
        if (req.session.tokens) {
            response.tokens = req.session.tokens;
        }
        
        res.json(response);
    } else {
        res.status(401).json({
            success: false,
            error: {
                message: 'Not authenticated',
                statusCode: 401
            }
        });
    }
});

// Check authentication status
router.get('/status', (req, res) => {
    res.json({
        success: true,
        authenticated: req.isAuthenticated(),
        user: req.isAuthenticated() ? {
            id: req.user.id,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar,
            guildId: req.user.guildId
        } : null
    });
});

// Refresh access token using refresh token
router.post('/refresh-token', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        throw new AuthenticationError('Refresh token is required');
    }
    
    try {
        const result = await jwtAuth.refreshAccessToken(refreshToken);
        
        res.json({
            success: true,
            message: 'Access token refreshed',
            accessToken: result.accessToken,
            user: result.user,
            expiresIn: 15 * 60 // 15 minutes in seconds
        });
    } catch (error) {
        throw new AuthenticationError('Invalid or expired refresh token');
    }
}));

// Refresh user data from Discord
router.post('/refresh', asyncHandler(async (req, res) => {
    if (!req.isAuthenticated()) {
        throw new AuthenticationError('Not authenticated');
    }
    
    try {
        // Fetch updated user data from Discord
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `Bearer ${req.user.accessToken}`
            }
        });
        
        if (!userResponse.ok) {
            throw new ExternalServiceError('Discord', 'Failed to fetch user data');
        }
        
        const userData = await userResponse.json();
        
        // Update user data
        const updatedUser = {
            ...req.user,
            username: userData.username,
            discriminator: userData.discriminator,
            avatar: userData.avatar
        };
        
        // Update in database
        database.saveUser(req.user.id, updatedUser);
        
        // Update session
        req.user = updatedUser;
        
        res.json({
            success: true,
            message: 'User data refreshed',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                discriminator: updatedUser.discriminator,
                avatar: updatedUser.avatar,
                guildId: updatedUser.guildId
            }
        });
    } catch (error) {
        throw new ExternalServiceError('Discord', error.message);
    }
}));

module.exports = router;
