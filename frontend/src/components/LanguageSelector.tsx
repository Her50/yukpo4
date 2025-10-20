// 🌍 Sélecteur de Langue - Frontend
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface LanguageSelectorProps {
    compact?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false }) => {
    const { language, setLanguage, t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    const languages = [
        { code: 'fr', name: 'Français', flag: '🇫🇷' },
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'zh', name: '中文', flag: '🇨🇳' },
        { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
        { code: 'ar', name: 'العربية', flag: '🇸🇦' },
        { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    ];

    const currentLanguage = languages.find(lang => lang.code === language) || languages[0];

    if (compact) {
        return (
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    title={t('language.title')}
                >
                    <span className="text-lg">{currentLanguage.flag}</span>
                    <span className="text-sm font-medium">{currentLanguage.code.toUpperCase()}</span>
                </button>

                {isOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="py-2">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => {
                                        setLanguage(lang.code);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors ${language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                        }`}
                                >
                                    <span className="text-lg">{lang.flag}</span>
                                    <span className="font-medium">{lang.name}</span>
                                    {language === lang.code && (
                                        <span className="ml-auto text-blue-600">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
                <span className="text-xl">{currentLanguage.flag}</span>
                <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">{currentLanguage.name}</div>
                    <div className="text-xs text-gray-500">{t('language.title')}</div>
                </div>
                <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-2">
                        <div className="text-xs font-medium text-gray-500 px-3 py-2 border-b border-gray-100">
                            {t('language.title')}
                        </div>
                        <div className="py-2">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => {
                                        setLanguage(lang.code);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors ${language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                        }`}
                                >
                                    <span className="text-xl">{lang.flag}</span>
                                    <div className="flex-1">
                                        <div className="font-medium">{lang.name}</div>
                                        <div className="text-xs text-gray-500">{lang.code.toUpperCase()}</div>
                                    </div>
                                    {language === lang.code && (
                                        <span className="text-blue-600">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LanguageSelector;