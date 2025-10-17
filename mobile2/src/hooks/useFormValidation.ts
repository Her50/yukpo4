import { useCallback, useState } from 'react';

interface ValidationRule {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
}

interface ValidationRules {
    [key: string]: ValidationRule;
}

interface ValidationResult {
    isValid: boolean;
    errors: { [key: string]: string };
    validateField: (fieldName: string, value: any) => string | null;
    validateForm: (data: any) => boolean;
    clearErrors: () => void;
    setError: (fieldName: string, error: string) => void;
}

export const useFormValidation = (rules: ValidationRules): ValidationResult => {
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const validateField = useCallback((fieldName: string, value: any): string | null => {
        const rule = rules[fieldName];
        if (!rule) return null;

        // Validation required
        if (rule.required && (!value || value === '' || (Array.isArray(value) && value.length === 0))) {
            return `${fieldName} est requis`;
        }

        // Si la valeur est vide et pas required, pas d'erreur
        if (!value || value === '') return null;

        // Validation minLength
        if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
            return `${fieldName} doit contenir au moins ${rule.minLength} caractères`;
        }

        // Validation maxLength
        if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
            return `${fieldName} ne peut pas dépasser ${rule.maxLength} caractères`;
        }

        // Validation pattern
        if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
            return `${fieldName} a un format invalide`;
        }

        // Validation custom
        if (rule.custom) {
            return rule.custom(value);
        }

        return null;
    }, [rules]);

    const validateForm = useCallback((data: any): boolean => {
        const newErrors: { [key: string]: string } = {};
        let isValid = true;

        Object.keys(rules).forEach(fieldName => {
            const error = validateField(fieldName, data[fieldName]);
            if (error) {
                newErrors[fieldName] = error;
                isValid = false;
            }
        });

        setErrors(newErrors);
        return isValid;
    }, [rules, validateField]);

    const clearErrors = useCallback(() => {
        setErrors({});
    }, []);

    const setError = useCallback((fieldName: string, error: string) => {
        setErrors(prev => ({ ...prev, [fieldName]: error }));
    }, []);

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        validateField,
        validateForm,
        clearErrors,
        setError
    };
};


