/**
 * Admin Authentication Middleware
 * Provides admin-level access control for the admin panel
 */

const config = require('../config/config');
const database = require('../config/hybrid-database');

/**
 * Check if user is authenticated and has admin privileges
 * Now checks the adminAccess flag from the database
 */
async function requireAdmin(req, res, next) {
    try {
        // Debug logging
        console.log('[Admin Auth] Checking authentication:', {
            hasUser: !!req.user,
            userId: req.user?.id,
            username: req.user?.username,
            authStatus: req.authStatus
        });
        
        // Check if user is authenticated (has valid session)
        if (!req.user || !req.user.id) {
            console.log('[Admin Auth] Authentication failed:', {
                reason: !req.user ? 'No user object' : 'No user ID',
                authStatus: req.authStatus
            });
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please log in to access the admin panel'
            });
        }

        // Check admin access from database/cache
        const hasAdminAccess = await database.checkAdminAccess(req.user.id);
        
        if (!hasAdminAccess) {
            console.log('[Admin Auth] Admin access denied:', {
                userId: req.user.id,
                username: req.user.username,
                reason: 'User does not have admin role'
            });
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'You do not have permission to access the admin panel'
            });
        }
        
        // Log admin access
        console.log(`[Admin] User ${req.user.id} (${req.user.username}) accessed admin panel`);
        
        next();
    } catch (error) {
        console.error('[Admin] Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication error',
            message: 'Internal server error during authentication'
        });
    }
}

/**
 * Optional: Check for specific admin Discord role
 * Uncomment and modify this if you want role-based admin access
 */
async function requireAdminRole(req, res, next) {
    try {
        if (!req.user || !req.user.discordId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Check if user has admin role in Discord
        // This would require Discord API integration to check user roles
        // For now, we'll skip this and allow any authenticated user
        
        next();
    } catch (error) {
        console.error('[Admin] Role check error:', error);
        return res.status(500).json({
            success: false,
            error: 'Role verification error'
        });
    }
}

module.exports = {
    requireAdmin,
    requireAdminRole
};
