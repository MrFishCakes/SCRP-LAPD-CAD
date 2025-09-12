const express = require('express');
const passport = require('passport');
const { asyncHandler } = require('../middleware/error');
const { checkCookieAuth } = require('../middleware/simple-auth');
const database = require('../config/hybrid-database');
const discordAPI = require('../lib/discord-api');
const logger = require('../utils/logger');

const router = express.Router();

// Discord OAuth Strategy
passport.use('discord', new (require('passport-discord').Strategy)({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
    scope: ['identify', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // In development, skip guild/role checks
        if (process.env.NODE_ENV === 'development') {
            logger.info('Development mode: Skipping guild/role verification');
            return done(null, profile);
        }

        // Production guild/role verification (disabled for now)
        // TODO: Implement guild and role verification when needed
        logger.info('Production mode: Guild/role verification disabled');
        return done(null, profile);

    } catch (error) {
        logger.error('Discord OAuth error', { error: error.message });
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Check authentication status
router.get('/check', checkCookieAuth, (req, res) => {
    switch (req.authStatus) {
        case 'valid':
            res.json({ authenticated: true });
            break;
        case 'no_cookie':
            res.json({ authenticated: false, reason: 'No authentication cookie found' });
            break;
        case 'no_match':
            res.json({ authenticated: false, reason: 'Invalid authentication cookie' });
            break;
        case 'expired':
            res.json({ authenticated: false, reason: 'Authentication expired' });
            break;
        case 'expiring_soon':
            res.json({ authenticated: false, reason: 'Authentication expires soon, please re-authenticate' });
            break;
        case 'error':
            res.json({ authenticated: false, reason: 'Authentication error occurred' });
            break;
        default:
            res.json({ authenticated: false, reason: 'Unknown authentication status' });
    }
});

// Discord OAuth routes
router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/no-hello' }),
    asyncHandler(async (req, res) => {
        try {
            // Check admin access in production mode
            let adminAccess = false;
            if (process.env.NODE_ENV === 'production') {
                adminAccess = await discordAPI.checkAdminAccess(req.user.id);
                logger.info('Admin access check completed', { 
                    discordId: req.user.id, 
                    username: req.user.username,
                    adminAccess 
                });
            } else {
                // In development, grant admin access to all users
                adminAccess = true;
                logger.info('Development mode: Granting admin access', { 
                    discordId: req.user.id, 
                    username: req.user.username 
                });
            }

            // Save user to database with admin access status
            await database.saveUser(req.user.id, {
                username: req.user.username,
                adminAccess: adminAccess
            });
            
            // Set authentication cookie
            const expires = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
            res.cookie('discord_id', req.user.id, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax',
                expires: expires
            });
            
            logger.info('User authenticated successfully', { 
                discordId: req.user.id, 
                username: req.user.username,
                adminAccess 
            });
            
            // Redirect to hello world page
            res.redirect('/hello');
        } catch (error) {
            logger.error('Failed to save user after authentication', { 
                error: error.message,
                discordId: req.user.id 
            });
            res.redirect('/no-hello');
        }
    })
);

// Logout route
router.post('/logout', (req, res) => {
    // Clear authentication cookie
    res.clearCookie('discord_id');
    logger.info('User logged out');
    res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;