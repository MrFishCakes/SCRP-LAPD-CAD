/**
 * Validation utilities
 * Common validation functions for API requests
 */

const { ValidationError } = require('../middleware/error');

/**
 * Validate email format
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number format
 */
function validatePhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

/**
 * Validate Discord ID format
 */
function validateDiscordId(id) {
    const discordIdRegex = /^\d{17,19}$/;
    return discordIdRegex.test(id);
}

/**
 * Validate required fields
 */
function validateRequired(data, requiredFields) {
    const missing = [];
    
    requiredFields.forEach(field => {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            missing.push(field);
        }
    });
    
    if (missing.length > 0) {
        throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }
}

/**
 * Validate string length
 */
function validateStringLength(value, fieldName, minLength = 1, maxLength = 255) {
    if (typeof value !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`);
    }
    
    if (value.length < minLength) {
        throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`);
    }
    
    if (value.length > maxLength) {
        throw new ValidationError(`${fieldName} must be no more than ${maxLength} characters long`);
    }
}

/**
 * Validate numeric range
 */
function validateNumericRange(value, fieldName, min = null, max = null) {
    const num = parseFloat(value);
    
    if (isNaN(num)) {
        throw new ValidationError(`${fieldName} must be a valid number`);
    }
    
    if (min !== null && num < min) {
        throw new ValidationError(`${fieldName} must be at least ${min}`);
    }
    
    if (max !== null && num > max) {
        throw new ValidationError(`${fieldName} must be no more than ${max}`);
    }
    
    return num;
}

/**
 * Validate coordinates
 */
function validateCoordinates(x, y, z = null) {
    const validX = validateNumericRange(x, 'X coordinate', -180, 180);
    const validY = validateNumericRange(y, 'Y coordinate', -90, 90);
    const validZ = z !== null ? validateNumericRange(z, 'Z coordinate') : null;
    
    return { x: validX, y: validY, z: validZ };
}

/**
 * Validate call data
 */
function validateCallData(data) {
    validateRequired(data, ['title', 'description', 'location']);
    
    validateStringLength(data.title, 'Title', 1, 100);
    validateStringLength(data.description, 'Description', 1, 500);
    validateStringLength(data.location, 'Location', 1, 200);
    
    if (data.priority && !['low', 'normal', 'high', 'emergency'].includes(data.priority)) {
        throw new ValidationError('Priority must be one of: low, normal, high, emergency');
    }
    
    if (data.type && !['general', 'traffic', 'medical', 'fire', 'police'].includes(data.type)) {
        throw new ValidationError('Type must be one of: general, traffic, medical, fire, police');
    }
}

/**
 * Validate 911 call data
 */
function validate911CallData(data) {
    validateRequired(data, ['callerName', 'callerPhone', 'description', 'location']);
    
    validateStringLength(data.callerName, 'Caller name', 1, 100);
    validateStringLength(data.description, 'Description', 1, 500);
    validateStringLength(data.location, 'Location', 1, 200);
    
    if (!validatePhone(data.callerPhone)) {
        throw new ValidationError('Invalid phone number format');
    }
    
    if (data.emergencyType && !['medical', 'fire', 'police', 'traffic', 'other'].includes(data.emergencyType)) {
        throw new ValidationError('Emergency type must be one of: medical, fire, police, traffic, other');
    }
}

/**
 * Validate unit status
 */
function validateUnitStatus(status) {
    const validStatuses = [
        '10-8',   // Available
        '10-6',   // Busy
        '10-7',   // Out of service
        '10-23',  // Arrived on scene
        '10-24',  // Assignment completed
        '10-97',  // Arrived at scene
        '10-98',  // Assignment completed
        '10-99',  // Officer needs help
        '10-100', // Out of service
        '10-200', // Police needed
        '10-300', // Officer down
        '10-400', // Officer needs assistance
        '10-500', // Officer needs help
        '10-600', // Officer needs assistance
        '10-700', // Officer needs help
        '10-800', // Officer needs assistance
        '10-900', // Officer needs help
        '10-1000' // Officer needs assistance
    ];
    
    if (!validStatuses.includes(status)) {
        throw new ValidationError(`Invalid unit status: ${status}`);
    }
}

/**
 * Validate blip data
 */
function validateBlipData(data) {
    validateRequired(data, ['title', 'x', 'y']);
    
    validateStringLength(data.title, 'Title', 1, 100);
    
    if (data.description) {
        validateStringLength(data.description, 'Description', 1, 500);
    }
    
    const coordinates = validateCoordinates(data.x, data.y, data.z);
    
    if (data.type && !['marker', 'area', 'route', 'zone'].includes(data.type)) {
        throw new ValidationError('Type must be one of: marker, area, route, zone');
    }
    
    if (data.color && !/^#[0-9A-F]{6}$/i.test(data.color)) {
        throw new ValidationError('Color must be a valid hex color (e.g., #FF0000)');
    }
    
    return {
        ...data,
        x: coordinates.x,
        y: coordinates.y,
        z: coordinates.z
    };
}

/**
 * Validate search query
 */
function validateSearchQuery(query) {
    if (!query || typeof query !== 'string') {
        throw new ValidationError('Search query is required and must be a string');
    }
    
    const trimmed = query.trim();
    
    if (trimmed.length < 2) {
        throw new ValidationError('Search query must be at least 2 characters long');
    }
    
    if (trimmed.length > 100) {
        throw new ValidationError('Search query must be no more than 100 characters long');
    }
    
    return trimmed;
}

/**
 * Sanitize string input
 */
function sanitizeString(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
}

/**
 * Validate pagination parameters
 */
function validatePagination(page, limit) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    
    if (pageNum < 1) {
        throw new ValidationError('Page must be at least 1');
    }
    
    if (limitNum < 1 || limitNum > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
    }
    
    return {
        page: pageNum,
        limit: limitNum,
        offset: (pageNum - 1) * limitNum
    };
}

/**
 * Validate date range
 */
function validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
        throw new ValidationError('Invalid start date');
    }
    
    if (isNaN(end.getTime())) {
        throw new ValidationError('Invalid end date');
    }
    
    if (start > end) {
        throw new ValidationError('Start date must be before end date');
    }
    
    const now = new Date();
    if (start > now) {
        throw new ValidationError('Start date cannot be in the future');
    }
    
    return { start, end };
}

module.exports = {
    validateEmail,
    validatePhone,
    validateDiscordId,
    validateRequired,
    validateStringLength,
    validateNumericRange,
    validateCoordinates,
    validateCallData,
    validate911CallData,
    validateUnitStatus,
    validateBlipData,
    validateSearchQuery,
    sanitizeString,
    validatePagination,
    validateDateRange
};
