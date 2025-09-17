import express, { Request, Response, Router } from 'express';
import passport from 'passport';
import { asyncHandler } from '../middleware/error';
import { checkCookieAuth } from '../middleware/simple-auth';
import database from '../config/hybrid-database';
import logger from '../utils/logger';

const router: Router = express.Router();

// Discord OAuth Strategy
passport.use('discord', new (require('passport-discord').Strategy)({
    clientID: process.env['DISCORD_CLIENT_ID'],
    clientSecret: process.env['DISCORD_CLIENT_SECRET'],
    callbackURL: process.env['DISCORD_REDIRECT_URI'] || 'http://localhost:3000/auth/discord/callback',
    scope: ['identify', 'guilds']
}, async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
    try {
        // In development, skip guild/role checks
        if (process.env['NODE_ENV'] === 'development') {
            logger.info('Development mode: Skipping guild/role verification');
            return done(null, profile);
        }

        // Production guild/role verification (disabled for now)
        // TODO: Implement guild and role verification when needed
        logger.info('Production mode: Guild/role verification disabled');
        return done(null, profile);

    } catch (error: any) {
        logger.error('Discord OAuth error:', error);
        return done(error, null);
    }
}));

// Serialize user for session
passport.serializeUser((user: any, done: any) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done: any) => {
    try {
        const user = await database.getUser(id);
        done(null, user);
    } catch (error: any) {
        done(error, null);
    }
});

// Discord OAuth login
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth callback
router.get('/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/login?error=discord_auth_failed' }),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const profile = req.user as any;
            
            if (!profile) {
                logger.error('No profile received from Discord OAuth');
                return res.redirect('/login?error=no_profile');
            }

            logger.info('Discord OAuth successful', {
                userId: profile.id,
                username: profile.username,
                discriminator: profile.discriminator
            });

            // Check if user exists in database
            let user = await database.getUser(profile.id);
            
            if (!user) {
                // Create new user
                user = await database.createUser({
                    id: profile.id,
                    username: profile.username,
                    discriminator: profile.discriminator,
                    avatar: profile.avatar,
                    sonoranUuid: null,
                    callsign: null,
                    name: null,
                    rank: null,
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                });
                
                logger.info('Created new user', { userId: profile.id });
            } else {
                // Update last login
                await database.updateUser(profile.id, {
                    lastLogin: new Date().toISOString()
                });
                
                logger.info('Updated user login', { userId: profile.id });
            }

            // Set cookie for authentication
            res.cookie('discord_id', profile.id, {
                httpOnly: true,
                secure: process.env['NODE_ENV'] === 'production',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                sameSite: 'strict'
            });

            // Redirect to main application
            res.redirect('/hello');
            
        } catch (error: any) {
            logger.error('Discord OAuth callback error:', error);
            res.redirect('/login?error=callback_failed');
        }
    })
);

// Logout
router.post('/logout', checkCookieAuth, asyncHandler(async (req: Request, res: Response) => {
    try {
        // Clear the Discord ID cookie
        res.clearCookie('discord_id');
        
        // Destroy session if using sessions
        if (req.session) {
            req.session.destroy((err: any) => {
                if (err) {
                    logger.error('Session destruction error:', err);
                }
            });
        }
        
        logger.info('User logged out', { 
            discordId: req.cookies['discord_id'] 
        });
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error: any) {
        logger.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed',
            message: error.message
        });
    }
}));

// Get current user info
router.get('/me', checkCookieAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const discordId = req.cookies['discord_id'];
        const user = await database.getUser(discordId);
        
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        
        res.json({
            success: true,
            user: {
                discordId: user.id,
                username: user.username,
                discriminator: user.discriminator,
                avatar: user.avatar,
                sonoranUuid: user.sonoranUuid,
                callsign: user.callsign,
                name: user.name,
                rank: user.rank,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });
        
    } catch (error: any) {
        logger.error('Get user info error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user info',
            message: error.message
        });
    }
}));


// Update user profile
router.put('/profile', checkCookieAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const discordId = req.cookies['discord_id'];
        const { sonoranUuid, callsign, name, rank } = req.body;
        
        const updateData: any = {};
        if (sonoranUuid !== undefined) updateData.sonoranUuid = sonoranUuid;
        if (callsign !== undefined) updateData.callsign = callsign;
        if (name !== undefined) updateData.name = name;
        if (rank !== undefined) updateData.rank = rank;
        
        const updatedUser = await database.updateUser(discordId, updateData);
        
        if (!updatedUser) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });
        
    } catch (error: any) {
        logger.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile',
            message: error.message
        });
    }
}));

export default router;
