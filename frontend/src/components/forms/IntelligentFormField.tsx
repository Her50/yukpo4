// 🧠 Composant de champ de formulaire intelligent avec traduction automatique
import { useIntelligentLanguage } from '@/hooks/useIntelligentLanguage';
import { AlertCircle, CheckCircle, Globe, Languages } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface IntelligentFormFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'textarea' | 'email' | 'tel' | 'url';
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    autoTranslate?: boolean;
    context?: string;
    className?: string;
    rows?: number;
}

const IntelligentFormField: React.FC<IntelligentFormFieldProps> = ({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    required = false,
    disabled = false,
    autoTranslate = true,
    context = 'form',
    className = '',
    rows = 3
}) => {
    const { translateText, currentLanguage } = useIntelligentLanguage();
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationStatus, setTranslationStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [originalValue, setOriginalValue] = useState(value);
    const [translatedValue, setTranslatedValue] = useState(value);
    const timeoutRef = useRef<NodeJS.Timeout>();

    // Effet pour la traduction automatique lors de la saisie
    useEffect(() => {
        if (!autoTranslate || !value || value === originalValue) return;

        // Délai pour éviter trop de traductions
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(async () => {
            if (value.length > 3) { // Seulement pour les textes significatifs
                setIsTranslating(true);
                setTranslationStatus('idle');

                try {
                    const translated = await translateText(value, context);
                    if (translated !== value) {
                        setTranslatedValue(translated);
                        setTranslationStatus('success');
                    }
                } catch (error) {
                    console.warn('Erreur traduction automatique:', error);
                    setTranslationStatus('error');
                } finally {
                    setIsTranslating(false);
                }
            }
        }, 1000); // Délai de 1 seconde

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [value, autoTranslate, context, originalValue, translateText]);

    const handleTranslate = async () => {
        if (!value || value === originalValue) return;

        setIsTranslating(true);
        setTranslationStatus('idle');

        try {
            const translated = await translateText(value, context);
            setTranslatedValue(translated);
            setTranslationStatus('success');
        } catch (error) {
            console.warn('Erreur traduction manuelle:', error);
            setTranslationStatus('error');
        } finally {
            setIsTranslating(false);
        }
    };

    const handleApplyTranslation = () => {
        if (translatedValue !== value) {
            onChange(translatedValue);
            setOriginalValue(translatedValue);
            setTranslationStatus('idle');
        }
    };

    const handleRevertTranslation = () => {
        setTranslatedValue(originalValue);
        setTranslationStatus('idle');
    };

    const renderInput = () => {
        const baseClasses = `w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`;

        if (type === 'textarea') {
            return (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    rows={rows}
                    className={baseClasses}
                />
            );
        }

        return (
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                className={baseClasses}
            />
        );
    };

    return (
        <div className="space-y-2">
            {/* Label avec indicateur de traduction */}
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {autoTranslate && (
                    <div className="flex items-center gap-2">
                        {isTranslating && (
                            <div className="flex items-center gap-1 text-blue-600">
                                <Globe className="w-4 h-4 animate-spin" />
                                <span className="text-xs">Traduction...</span>
                            </div>
                        )}

                        {translationStatus === 'success' && translatedValue !== value && (
                            <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs">Traduit</span>
                            </div>
                        )}

                        {translationStatus === 'error' && (
                            <div className="flex items-center gap-1 text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-xs">Erreur</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Champ de saisie */}
            {renderInput()}

            {/* Suggestions de traduction */}
            {autoTranslate && translationStatus === 'success' && translatedValue !== value && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Languages className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">
                                Suggestion de traduction ({currentLanguage})
                            </span>
                        </div>
                    </div>

                    <p className="text-sm text-blue-800 mb-3">
                        {translatedValue}
                    </p>

                    <div className="flex gap-2">
                        <button
                            onClick={handleApplyTranslation}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                        >
                            Appliquer
                        </button>
                        <button
                            onClick={handleRevertTranslation}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition-colors"
                        >
                            Ignorer
                        </button>
                    </div>
                </div>
            )}

            {/* Bouton de traduction manuelle */}
            {autoTranslate && value && value.length > 3 && translationStatus === 'idle' && (
                <button
                    onClick={handleTranslate}
                    disabled={isTranslating}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                    <Globe className="w-4 h-4" />
                    {isTranslating ? 'Traduction...' : 'Traduire automatiquement'}
                </button>
            )}
        </div>
    );
};

export default IntelligentFormField;


