/**
 * Discord API Helper
 * Provides utilities for checking user roles and guild membership
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class DiscordAPI {
    constructor() {
        this.botToken = process.env.DISCORD_BOT_TOKEN;
        this.guildId = process.env.DISCORD_GUILD_ID;
        this.adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID;
        
        if (!this.botToken) {
            logger.warn('DISCORD_BOT_TOKEN not set - role checking will be disabled');
        }
    }

    /**
     * Check if a user has admin access by verifying their Discord role
     * @param {string} discordId - The Discord user ID
     * @returns {Promise<boolean>} - True if user has admin role
     */
    async checkAdminAccess(discordId) {
        try {
            // Skip role checking in development mode
            if (process.env.NODE_ENV === 'development') {
                logger.info('Development mode: Granting admin access to all users');
                return true;
            }

            // Skip if bot token is not configured
            if (!this.botToken || !this.guildId || !this.adminRoleId) {
                logger.warn('Discord configuration incomplete - denying admin access');
                return false;
            }

            // Get user's guild member information
            const member = await this.getGuildMember(discordId);
            if (!member) {
                logger.info('User not found in guild', { discordId });
                return false;
            }

            // Check if user has the admin role
            const hasAdminRole = member.roles.includes(this.adminRoleId);
            
            logger.info('Admin role check completed', { 
                discordId, 
                hasAdminRole,
                userRoles: member.roles 
            });

            return hasAdminRole;

        } catch (error) {
            logger.error('Failed to check admin access', { 
                discordId, 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * Get guild member information from Discord API
     * @param {string} discordId - The Discord user ID
     * @returns {Promise<Object|null>} - Guild member object or null if not found
     */
    async getGuildMember(discordId) {
        try {
            const response = await axios.get(
                `https://discord.com/api/v10/guilds/${this.guildId}/members/${discordId}`,
                {
                    headers: {
                        'Authorization': `Bot ${this.botToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000 // 5 second timeout
                }
            );

            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                // User not found in guild
                return null;
            }
            
            logger.error('Discord API error', { 
                discordId, 
                status: error.response?.status,
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Check if a user is a member of the required guild
     * @param {string} discordId - The Discord user ID
     * @returns {Promise<boolean>} - True if user is in the guild
     */
    async isGuildMember(discordId) {
        try {
            const member = await this.getGuildMember(discordId);
            return member !== null;
        } catch (error) {
            logger.error('Failed to check guild membership', { 
                discordId, 
                error: error.message 
            });
            return false;
        }
    }
}

module.exports = new DiscordAPI();