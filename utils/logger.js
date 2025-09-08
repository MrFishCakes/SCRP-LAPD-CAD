/**
 * Logging utility
 * Centralized logging with different levels and formats
 */

const config = require('../config/config');
const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logLevel = config.logging.level;
        this.enableConsole = config.logging.enableConsole;
        this.enableFile = config.logging.enableFile;
        this.logFile = config.logging.logFile;
        
        // Create logs directory if it doesn't exist
        if (this.enableFile) {
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
        
        // Define log levels
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    /**
     * Check if log level should be logged
     */
    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    /**
     * Format log message
     */
    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    }

    /**
     * Write to console
     */
    writeToConsole(level, message, meta) {
        if (!this.enableConsole) return;
        
        const formattedMessage = this.formatMessage(level, message, meta);
        
        switch (level) {
            case 'error':
                console.error(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'info':
                console.info(formattedMessage);
                break;
            case 'debug':
                console.debug(formattedMessage);
                break;
            default:
                console.log(formattedMessage);
        }
    }

    /**
     * Write to file
     */
    writeToFile(level, message, meta) {
        if (!this.enableFile) return;
        
        const formattedMessage = this.formatMessage(level, message, meta);
        
        try {
            fs.appendFileSync(this.logFile, formattedMessage + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    /**
     * Log message
     */
    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;
        
        this.writeToConsole(level, message, meta);
        this.writeToFile(level, message, meta);
    }

    /**
     * Error level logging
     */
    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    /**
     * Warning level logging
     */
    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    /**
     * Info level logging
     */
    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    /**
     * Debug level logging
     */
    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    /**
     * Log HTTP request
     */
    logRequest(req, res, responseTime) {
        const meta = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user ? req.user.id : 'anonymous'
        };
        
        const level = res.statusCode >= 400 ? 'error' : 'info';
        this.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    }

    /**
     * Log API call
     */
    logApiCall(userId, endpoint, method, status, responseTime, error = null) {
        const meta = {
            userId,
            endpoint,
            method,
            status,
            responseTime: `${responseTime}ms`,
            error: error ? error.message : null
        };
        
        const level = status >= 400 ? 'error' : 'info';
        this.log(level, `API Call: ${method} ${endpoint}`, meta);
    }

    /**
     * Log authentication event
     */
    logAuth(event, userId, success, details = {}) {
        const meta = {
            event,
            userId,
            success,
            ...details
        };
        
        const level = success ? 'info' : 'warn';
        this.log(level, `Auth Event: ${event}`, meta);
    }

    /**
     * Log system event
     */
    logSystem(event, details = {}) {
        const meta = {
            event,
            ...details
        };
        
        this.log('info', `System Event: ${event}`, meta);
    }

    /**
     * Get log statistics
     */
    getLogStats() {
        if (!this.enableFile || !fs.existsSync(this.logFile)) {
            return { error: 'Log file not available' };
        }
        
        try {
            const stats = fs.statSync(this.logFile);
            const content = fs.readFileSync(this.logFile, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            const levelCounts = {
                error: 0,
                warn: 0,
                info: 0,
                debug: 0
            };
            
            lines.forEach(line => {
                if (line.includes('ERROR:')) levelCounts.error++;
                else if (line.includes('WARN:')) levelCounts.warn++;
                else if (line.includes('INFO:')) levelCounts.info++;
                else if (line.includes('DEBUG:')) levelCounts.debug++;
            });
            
            return {
                fileSize: stats.size,
                totalLines: lines.length,
                levelCounts,
                lastModified: stats.mtime,
                firstLine: lines[0] || null,
                lastLine: lines[lines.length - 1] || null
            };
        } catch (error) {
            return { error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new Logger();
