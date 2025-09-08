/**
 * Helper utilities
 * Common helper functions used throughout the application
 */

const crypto = require('crypto');

/**
 * Generate a random string of specified length
 */
function generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure session secret
 */
function generateSessionSecret() {
    return crypto.randomBytes(32).toString('base64');
}

/**
 * Hash a string using SHA-256
 */
function hashString(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate a UUID v4
 */
function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Format date to ISO string
 */
function formatDate(date = new Date()) {
    return date.toISOString();
}

/**
 * Format date to human readable string
 */
function formatDateHuman(date = new Date()) {
    return date.toLocaleString();
}

/**
 * Calculate time difference in milliseconds
 */
function getTimeDifference(startTime, endTime = new Date()) {
    return endTime - startTime;
}

/**
 * Format time difference to human readable string
 */
function formatTimeDifference(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (typeof obj === 'object') {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }
}

/**
 * Merge objects deeply
 */
function deepMerge(target, source) {
    const result = deepClone(target);
    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    
    return result;
}

/**
 * Remove undefined values from object
 */
function removeUndefined(obj) {
    const result = {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    
    return result;
}

/**
 * Convert object to query string
 */
function objectToQueryString(obj) {
    const params = new URLSearchParams();
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined && obj[key] !== null) {
            params.append(key, obj[key]);
        }
    }
    
    return params.toString();
}

/**
 * Parse query string to object
 */
function parseQueryString(queryString) {
    const params = new URLSearchParams(queryString);
    const result = {};
    
    for (const [key, value] of params.entries()) {
        result[key] = value;
    }
    
    return result;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str) {
    if (typeof str !== 'string' || str.length === 0) {
        return str;
    }
    
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to title case
 */
function toTitleCase(str) {
    if (typeof str !== 'string') {
        return str;
    }
    
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

/**
 * Truncate string to specified length
 */
function truncateString(str, length = 100, suffix = '...') {
    if (typeof str !== 'string' || str.length <= length) {
        return str;
    }
    
    return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Check if string is empty or whitespace
 */
function isEmpty(str) {
    return !str || str.trim().length === 0;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
async function retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxAttempts) {
                throw lastError;
            }
            
            const delay = baseDelay * Math.pow(2, attempt - 1);
            await sleep(delay);
        }
    }
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
    let inThrottle;
    
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Get client IP address from request
 */
function getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           'unknown';
}

/**
 * Format file size in bytes to human readable string
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if value is a valid JSON string
 */
function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Safely parse JSON string
 */
function safeJSONParse(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return defaultValue;
    }
}

/**
 * Generate a random color in hex format
 */
function generateRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Get current timestamp in milliseconds
 */
function getCurrentTimestamp() {
    return Date.now();
}

/**
 * Get current timestamp in seconds
 */
function getCurrentTimestampSeconds() {
    return Math.floor(Date.now() / 1000);
}

module.exports = {
    generateRandomString,
    generateSessionSecret,
    hashString,
    generateUUID,
    formatDate,
    formatDateHuman,
    getTimeDifference,
    formatTimeDifference,
    deepClone,
    deepMerge,
    removeUndefined,
    objectToQueryString,
    parseQueryString,
    capitalize,
    toTitleCase,
    truncateString,
    isEmpty,
    sleep,
    retry,
    debounce,
    throttle,
    getClientIP,
    formatFileSize,
    isValidJSON,
    safeJSONParse,
    generateRandomColor,
    calculateDistance,
    getCurrentTimestamp,
    getCurrentTimestampSeconds
};
