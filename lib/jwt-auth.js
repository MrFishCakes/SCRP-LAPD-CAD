/**
 * JWT Authentication System
 * Handles token generation, validation, and refresh token management
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config/config');
const database = require('../config/hybrid-database');
const logger = require('../utils/logger');

class JWTAuth {
    constructor() {
        this.accessTokenSecret = config.session.secret;
        this.refreshTokenSecret = this.generateRefreshSecret();
        this.accessTokenExpiry = '15m'; // 15 minutes
        this.refreshTokenExpiry = '7d'; // 7 days
    }

    /**
     * Generate a secure refresh token secret
     */
    generateRefreshSecret() {
        return crypto.randomBytes(64).toString('hex');
    }

    /**
     * Generate access token
     */
    generateAccessToken(user) {
        const payload = {
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar,
            guildId: user.guildId,
            type: 'access'
        };

        return jwt.sign(payload, this.accessTokenSecret, {
            expiresIn: this.accessTokenExpiry,
            issuer: 'sonoran-cad-app',
            audience: 'sonoran-cad-users'
        });
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(user) {
        const payload = {
            id: user.id,
            type: 'refresh'
        };

        const token = jwt.sign(payload, this.refreshTokenSecret, {
            expiresIn: this.refreshTokenExpiry,
            issuer: 'sonoran-cad-app',
            audience: 'sonoran-cad-users'
        });

        // Hash the refresh token before storing
        const hashedToken = bcrypt.hashSync(token, 10);
        
        return {
            token,
            hashedToken
        };
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, this.accessTokenSecret, {
                issuer: 'sonoran-cad-app',
                audience: 'sonoran-cad-users'
            });

            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            logger.warn('Access token verification failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Verify refresh token
     */
    async verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, this.refreshTokenSecret, {
                issuer: 'sonoran-cad-app',
                audience: 'sonoran-cad-users'
            });

            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            // Check if refresh token exists in database
            const storedToken = database.getRefreshToken(decoded.id);
            if (!storedToken) {
                throw new Error('Refresh token not found');
            }

            // Verify the token matches the stored hash
            const isValid = bcrypt.compareSync(token, storedToken.hashedToken);
            if (!isValid) {
                throw new Error('Invalid refresh token');
            }

            return decoded;
        } catch (error) {
            logger.warn('Refresh token verification failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Store refresh token in database
     */
    storeRefreshToken(userId, hashedToken) {
        const tokenData = {
            userId,
            hashedToken,
            createdAt: new Date(),
            lastUsed: new Date()
        };

        database.saveRefreshToken(userId, tokenData);
        logger.info('Refresh token stored', { userId });
    }

    /**
     * Revoke refresh token
     */
    revokeRefreshToken(userId) {
        database.deleteRefreshToken(userId);
        logger.info('Refresh token revoked', { userId });
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken) {
        try {
            const decoded = await this.verifyRefreshToken(refreshToken);
            const user = database.getUser(decoded.id);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Generate new access token
            const newAccessToken = this.generateAccessToken(user);
            
            // Update last used time for refresh token
            database.updateRefreshTokenLastUsed(decoded.id);

            logger.info('Access token refreshed', { userId: decoded.id });

            return {
                accessToken: newAccessToken,
                user: {
                    id: user.id,
                    username: user.username,
                    discriminator: user.discriminator,
                    avatar: user.avatar,
                    guildId: user.guildId
                }
            };
        } catch (error) {
            logger.error('Token refresh failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Generate token pair (access + refresh)
     */
    generateTokenPair(user) {
        const accessToken = this.generateAccessToken(user);
        const { token: refreshToken, hashedToken } = this.generateRefreshToken(user);

        // Store refresh token
        this.storeRefreshToken(user.id, hashedToken);

        return {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 minutes in seconds
            tokenType: 'Bearer'
        };
    }

    /**
     * Extract token from Authorization header
     */
    extractTokenFromHeader(authHeader) {
        if (!authHeader) {
            return null;
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return null;
        }

        return parts[1];
    }

    /**
     * Get token expiration time
     */
    getTokenExpiration(token) {
        try {
            const decoded = jwt.decode(token);
            return new Date(decoded.exp * 1000);
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if token is expired
     */
    isTokenExpired(token) {
        const expiration = this.getTokenExpiration(token);
        if (!expiration) {
            return true;
        }
        return expiration < new Date();
    }

    /**
     * Clean up expired refresh tokens
     */
    cleanupExpiredTokens() {
        const expiredTokens = database.getExpiredRefreshTokens();
        expiredTokens.forEach(token => {
            database.deleteRefreshToken(token.userId);
        });

        if (expiredTokens.length > 0) {
            logger.info('Cleaned up expired refresh tokens', { count: expiredTokens.length });
        }
    }

    /**
     * Get user from access token
     */
    getUserFromToken(token) {
        try {
            const decoded = this.verifyAccessToken(token);
            return database.getUser(decoded.id);
        } catch (error) {
            return null;
        }
    }

    /**
     * Revoke all tokens for a user
     */
    revokeAllUserTokens(userId) {
        this.revokeRefreshToken(userId);
        logger.info('All tokens revoked for user', { userId });
    }
}

module.exports = new JWTAuth();
