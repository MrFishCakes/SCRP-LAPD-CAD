/**
 * Script to set admin access for a specific user
 * Usage: node scripts/set-admin-access.js <discordId> <adminAccess>
 */

const database = require('../config/hybrid-database');
const logger = require('../utils/logger');

async function setAdminAccess(discordId, adminAccess) {
    try {
        console.log(`Setting admin access for user ${discordId} to ${adminAccess}...`);
        
        // Initialize database connection
        await database.initialize();
        
        // Get current user data
        const user = await database.getUser(discordId);
        if (!user) {
            console.error(`User ${discordId} not found in database`);
            return;
        }
        
        console.log('Current user data:', user);
        
        // Update user with new admin access
        await database.saveUser(discordId, {
            username: user.username,
            adminAccess: adminAccess
        });
        
        // Clear and update Redis cache
        await database.clearUserCache(discordId);
        
        // Also clear the admin access cache
        await database.deleteFromCache(`admin:${discordId}`);
        
        // Verify the update
        const updatedUser = await database.getUser(discordId);
        const adminCheck = await database.checkAdminAccess(discordId);
        
        console.log('✅ Admin access updated successfully!');
        console.log('Updated user data:', updatedUser);
        console.log('Admin access check result:', adminCheck);
        
    } catch (error) {
        console.error('❌ Error setting admin access:', error);
    } finally {
        // Close database connections
        if (database.redis) {
            await database.redis.quit();
        }
        if (database.sqlite) {
            database.sqlite.close();
        }
        process.exit(0);
    }
}

// Get command line arguments
const discordId = process.argv[2];
const adminAccess = process.argv[3] === 'true';

if (!discordId) {
    console.error('Usage: node scripts/set-admin-access.js <discordId> <true|false>');
    console.error('Example: node scripts/set-admin-access.js 215436164218224641 true');
    process.exit(1);
}

setAdminAccess(discordId, adminAccess);
