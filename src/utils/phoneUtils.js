
/**
 * Normalizes a phone number to the standard format: +91XXXXXXXXXX
 * @param {string} phone - The phone number to normalize
 * @returns {string} - The normalized phone number
 */
export const normalizePhoneNumber = (phone) => {
    if (!phone) return null;

    // Remove all non-numeric characters except +
    let cleaned = phone.toString().replace(/[^\d+]/g, '');

    // Case 1: User enters 10 digits (e.g., 9876543210)
    if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
        return `+91${cleaned}`;
    }

    // Case 2: User enters 91 followed by 10 digits (e.g., 919876543210)
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        return `+${cleaned}`;
    }

    // Case 3: User already enters +91 followed by 10 digits (e.g., +919876543210)
    if (cleaned.length === 13 && cleaned.startsWith('+91')) {
        return cleaned;
    }

    // If it doesn't match expected patterns, we still try to clean it 
    // but the validation should probably catch it if it's not a valid 10-digit base
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    
    return cleaned;
};

/**
 * Validates if the normalized phone number is a valid 10-digit Indian number
 * @param {string} phone - The normalized phone number
 * @returns {boolean}
 */
export const isValidPhoneNumber = (phone) => {
    if (!phone) return false;
    // Standard format: +91 followed by exactly 10 digits
    const regex = /^\+91\d{10}$/;
    return regex.test(phone);
};
