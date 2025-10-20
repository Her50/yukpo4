// Utilitaires de validation pour les paiements - Frontend
// Identique au mobile mais adapté pour TypeScript frontend

export interface PhoneValidationResult {
    valid: boolean;
    error?: string;
    country?: string;
    countryCode?: string;
    formattedNumber?: string;
}

export interface CardValidationResult {
    valid: boolean;
    type?: string;
    error?: string;
}

// Patterns de téléphone par pays
const PHONE_PATTERNS = {
    cameroun: {
        regex: /^(237|00237|\+237)?[26][0-9]{8}$/,
        length: 9,
        prefix: '+237',
        code: '237',
        format: 'Ex: 6XX XX XX XX (9 chiffres)',
        name: 'Cameroun'
    },
    gabon: {
        regex: /^(241|00241|\+241)?[017][0-9]{7}$/,
        length: 8,
        prefix: '+241',
        code: '241',
        format: 'Ex: 0X XX XX XX (8 chiffres)',
        name: 'Gabon'
    },
    rca: {
        regex: /^(236|00236|\+236)?[27][0-9]{7}$/,
        length: 8,
        prefix: '+236',
        code: '236',
        format: 'Ex: 7X XX XX XX (8 chiffres)',
        name: 'RCA'
    },
    congo_brazza: {
        regex: /^(242|00242|\+242)?[05][0-9]{8}$/,
        length: 9,
        prefix: '+242',
        code: '242',
        format: 'Ex: 0X XX XX XX X (9 chiffres)',
        name: 'Congo-Brazzaville'
    },
    tchad: {
        regex: /^(235|00235|\+235)?[69][0-9]{7}$/,
        length: 8,
        prefix: '+235',
        code: '235',
        format: 'Ex: 6X XX XX XX (8 chiffres)',
        name: 'Tchad'
    },
    guinee_eq: {
        regex: /^(240|00240|\+240)?[2359][0-9]{8}$/,
        length: 9,
        prefix: '+240',
        code: '240',
        format: 'Ex: 2XX XX XX XX (9 chiffres)',
        name: 'Guinée Équatoriale'
    },
};

export const validatePhoneNumber = (phone: string): PhoneValidationResult => {
    if (!phone || phone.trim().length === 0) {
        return { valid: false, error: 'Numéro de téléphone requis' };
    }

    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

    let phoneWithoutPrefix = cleaned;
    let detectedCountry: string | null = null;
    let detectedCode: string | null = null;

    for (const [countryKey, pattern] of Object.entries(PHONE_PATTERNS)) {
        const prefixes = [`+${pattern.code}`, `00${pattern.code}`, pattern.code];
        for (const prefix of prefixes) {
            if (cleaned.startsWith(prefix)) {
                phoneWithoutPrefix = cleaned.substring(prefix.length);
                detectedCountry = countryKey;
                detectedCode = pattern.code;
                break;
            }
        }
        if (detectedCountry) break;
    }

    for (const [countryKey, pattern] of Object.entries(PHONE_PATTERNS)) {
        if (pattern.regex.test(cleaned)) {
            return {
                valid: true,
                country: pattern.name,
                countryCode: pattern.code,
                formattedNumber: `${pattern.prefix}${phoneWithoutPrefix}`
            };
        }

        const regexWithoutPrefix = new RegExp(`^[${pattern.regex.source.match(/\[([^\]]+)\]/)?.[1]}][0-9]{${pattern.length - 1}}$`);
        if (regexWithoutPrefix.test(phoneWithoutPrefix)) {
            return {
                valid: true,
                country: pattern.name,
                countryCode: pattern.code,
                formattedNumber: `${pattern.prefix}${phoneWithoutPrefix}`
            };
        }
    }

    if (phoneWithoutPrefix.length >= 8 && phoneWithoutPrefix.length <= 9) {
        const formats = Object.values(PHONE_PATTERNS).map(p => `${p.name}: ${p.format}`).join('\n');
        return {
            valid: false,
            error: `Numéro non reconnu.\n\nFormats acceptés:\n${formats}`
        };
    }

    return {
        valid: false,
        error: 'Numéro de téléphone invalide. Vérifiez le format.'
    };
};

export const validateCardNumber = (cardNumber: string): CardValidationResult => {
    if (!cardNumber || cardNumber.trim().length === 0) {
        return { valid: false, error: 'Numéro de carte requis' };
    }

    const cleaned = cardNumber.replace(/\s/g, '');

    if (!/^\d{13,19}$/.test(cleaned)) {
        return { valid: false, error: 'Le numéro de carte doit contenir 13 à 19 chiffres' };
    }

    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i]);

        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isEven = !isEven;
    }

    if (sum % 10 !== 0) {
        return { valid: false, error: 'Numéro de carte invalide (vérification échouée)' };
    }

    let type = 'Carte bancaire';
    if (/^4/.test(cleaned)) type = 'Visa';
    else if (/^5[1-5]/.test(cleaned)) type = 'Mastercard';
    else if (/^3[47]/.test(cleaned)) type = 'American Express';
    else if (/^6(?:011|5)/.test(cleaned)) type = 'Discover';

    return { valid: true, type };
};

export const validateCardExpiry = (expiry: string): { valid: boolean; error?: string } => {
    if (!expiry || expiry.trim().length === 0) {
        return { valid: false, error: 'Date d\'expiration requise' };
    }

    const cleaned = expiry.replace(/\s/g, '');

    if (!/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(cleaned)) {
        return { valid: false, error: 'Format invalide (MM/AA attendu)' };
    }

    const [month, year] = cleaned.split('/');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);

    if (fullYear < currentYear || (fullYear === currentYear && parseInt(month) < currentMonth)) {
        return { valid: false, error: 'Carte expirée' };
    }

    return { valid: true };
};

export const validateCVV = (cvv: string): { valid: boolean; error?: string } => {
    if (!cvv || cvv.trim().length === 0) {
        return { valid: false, error: 'CVV requis' };
    }

    if (!/^\d{3,4}$/.test(cvv)) {
        return { valid: false, error: 'CVV doit être 3 ou 4 chiffres' };
    }

    return { valid: true };
};

export const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

    if (cleaned.length === 9) {
        return cleaned.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    }

    if (cleaned.length === 8) {
        return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    }

    return phone;
};

export const formatCardNumber = (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted;
};

