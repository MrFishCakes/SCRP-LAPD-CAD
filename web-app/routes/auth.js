const express = require('express');
const passport = require('passport');
const { asyncHandler } = require('../middleware/error');
const { checkCookieAuth } = require('../middleware/simple-auth');
const database = require('../config/hybrid-database');
const discordAPI = require('../lib/discord/discord-api');
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
        case 'invalid_cookie':
            res.json({ authenticated: false, reason: 'Invalid or tampered authentication cookie' });
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

// Get user profile including SonoranCAD UUID status
router.get('/profile', checkCookieAuth, asyncHandler(async (req, res) => {
    try {
        // Only allow if user is authenticated
        if (req.authStatus !== 'valid') {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        // Get Discord ID from cookie
        const { verifyCookie } = require('../middleware/simple-auth');
        const signedCookie = req.cookies.discord_id;
        const discordId = verifyCookie(signedCookie);

        if (!discordId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid authentication' 
            });
        }

        // Get user data from database
        const user = await database.getUser(discordId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        res.json({ 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                adminAccess: user.adminAccess,
                hasSonoranUuid: !!user.sonoranUuid,
                sonoranUuid: user.sonoranUuid || null
            }
        });
        
    } catch (error) {
        logger.error('Error getting user profile:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get user profile' 
        });
    }
}));

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
            
            // Set authentication cookie using middleware function
            const { setAuthCookie } = require('../middleware/simple-auth');
            setAuthCookie(res, req.user.id);
            
            // Create session for tracking
            try {
                const sessionId = `${req.user.id}.${Date.now()}`;
                await database.createSession(
                    req.user.id,
                    sessionId,
                    req.ip,
                    req.get('User-Agent')
                );
            } catch (error) {
                logger.warn('Session creation error:', error.message);
            }
            
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

// Update SonoranCAD UUID route
router.post('/sonoran-uuid', checkCookieAuth, asyncHandler(async (req, res) => {
    try {
        // Only allow if user is authenticated
        if (req.authStatus !== 'valid') {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }

        const { sonoranUuid } = req.body;
        
        if (!sonoranUuid || typeof sonoranUuid !== 'string') {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid SonoranCAD UUID is required' 
            });
        }

        // Get Discord ID from cookie
        const { verifyCookie } = require('../middleware/simple-auth');
        const signedCookie = req.cookies.discord_id;
        const discordId = verifyCookie(signedCookie);

        if (!discordId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid authentication' 
            });
        }

        // Update SonoranCAD UUID in database
        const updated = await database.updateSonoranUuid(discordId, sonoranUuid);
        
        if (updated) {
            logger.info('SonoranCAD UUID updated', { 
                discordId, 
                sonoranUuid 
            });
            
            res.json({ 
                success: true, 
                message: 'SonoranCAD UUID updated successfully' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
    } catch (error) {
        logger.error('Error updating SonoranCAD UUID:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update SonoranCAD UUID' 
        });
    }
}));

// Logout route
router.post('/logout', asyncHandler(async (req, res) => {
    try {
        // Get Discord ID from cookie before clearing it
        const { verifyCookie } = require('../middleware/simple-auth');
        const signedCookie = req.cookies.discord_id;
        const discordId = signedCookie ? verifyCookie(signedCookie) : null;
        
        if (discordId) {
            logger.info('User logout initiated', { discordId });
            
            // Complete user data cleanup from both SQLite and Redis
            const cleanupResults = await database.completeUserLogout(discordId);
            
            // Log cleanup results
            logger.info('User logout cleanup completed', {
                discordId,
                sqliteDeleted: cleanupResults.sqlite.changes,
                redisKeysDeleted: cleanupResults.redis.deletedKeys.length,
                errors: cleanupResults.errors.length
            });
            
            // Log any errors that occurred
            if (cleanupResults.errors.length > 0) {
                logger.warn('Some cleanup operations failed during logout', {
                    discordId,
                    errors: cleanupResults.errors
                });
            }
        } else {
            logger.info('Logout attempted without valid Discord ID');
        }
        
        // Clear authentication cookie
        const { clearAuthCookie } = require('../middleware/simple-auth');
        clearAuthCookie(res);
        
        logger.info('User logout completed successfully', { discordId });
        res.json({ 
            success: true, 
            message: 'Logged out successfully. All user data has been removed from both database and cache.' 
        });
        
    } catch (error) {
        logger.error('Error during logout process', { error: error.message });
        
        // Still clear the cookie even if cleanup fails
        const { clearAuthCookie } = require('../middleware/simple-auth');
        clearAuthCookie(res);
        
        res.json({ 
            success: true, 
            message: 'Logged out successfully. Some cleanup operations may have failed.' 
        });
    }
}));

module.exports = router;