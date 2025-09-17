import { Request, Response, NextFunction } from 'express';
import database from '../config/hybrid-database';
import logger from '../utils/logger';

// Extend Request interface to include authStatus
declare global {
    namespace Express {
        interface Request {
            authStatus?: 'valid' | 'invalid' | 'expired';
        }
    }
}

/**
 * Simple cookie-based authentication middleware
 */
export const checkCookieAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
        const discordId = req.cookies['discord_id'];
        
        if (!discordId) {
            req.authStatus = 'invalid';
            return next();
        }

        // Check if user exists in database
        const user = await database.getUser(discordId);
        
        if (!user) {
            req.authStatus = 'invalid';
            return next();
        }

        // User is valid
        req.authStatus = 'valid';
        next();
        
    } catch (error: any) {
        logger.error('Authentication check error:', error);
        req.authStatus = 'invalid';
        next();
    }
};

/**
 * Verify cookie signature (placeholder for future implementation)
 */
export const verifyCookie = (req: Request): boolean => {
    // TODO: Implement proper cookie verification
    // For now, just check if the cookie exists
    return !!req.cookies['discord_id'];
};
