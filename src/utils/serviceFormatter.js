/**
 * Formats service data for display
 * Handles: JSON strings, arrays, objects, and plain strings
 * @param {*} service - The service data to format
 * @returns {string} Formatted service string, never [object Object]
 */
function formatService(service) {
    if (!service) return '';
    
    // If it's already a string
    if (typeof service === 'string') {
        // Try to parse as JSON
        try {
            const parsed = JSON.parse(service);
            if (Array.isArray(parsed)) {
                // Array of service objects or strings
                return parsed.map(item => {
                    if (typeof item === 'object' && item !== null) {
                        return item.name || item.service || JSON.stringify(item);
                    }
                    return String(item);
                }).join(', ');
            } else if (typeof parsed === 'object' && parsed !== null) {
                // Single service object
                return parsed.name || parsed.service || JSON.stringify(parsed);
            } else {
                // Parsed to primitive (string, number, etc.)
                return String(parsed);
            }
        } catch (e) {
            // Not valid JSON, return as is
            return service;
        }
    }
    
    // If it's an array
    if (Array.isArray(service)) {
        return service.map(item => {
            if (typeof item === 'object' && item !== null) {
                return item.name || item.service || JSON.stringify(item);
            }
            return String(item);
        }).join(', ');
    }
    
    // If it's an object
    if (typeof service === 'object') {
        return service.name || service.service || JSON.stringify(service);
    }
    
    // Default: convert to string
    return String(service);
}

/**
 * Formats phone numbers to start with 256 for Ugandan numbers
 * @param {string} phone - The phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhone(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // If already starts with 256, return as is
    if (cleanPhone.startsWith('256')) {
        return cleanPhone;
    }
    
    // If starts with 0, remove 0 and add 256 prefix
    if (cleanPhone.startsWith('0')) {
        return '256' + cleanPhone.slice(1);
    }
    
    // For any other number, add 256 prefix
    return '256' + cleanPhone;
}

module.exports = { formatService, formatPhone };
