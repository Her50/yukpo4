// 🔔 Composant de notification intelligente avec traduction automatique
import { useIntelligentLanguage } from '@/hooks/useIntelligentLanguage';
import { AlertCircle, CheckCircle, Globe, Languages, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface IntelligentNotificationProps {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
    onClose: (id: string) => void;
    autoTranslate?: boolean;
    context?: string;
    actions?: Array<{
        label: string;
        onClick: () => void;
        variant?: 'primary' | 'secondary';
    }>;
}

const IntelligentNotification: React.FC<IntelligentNotificationProps> = ({
    id,
    title,
    message,
    type,
    duration = 5000,
    onClose,
    autoTranslate = true,
    context = 'notification',
    actions = []
}) => {
    const { translateText, currentLanguage } = useIntelligentLanguage();
    const [translatedTitle, setTranslatedTitle] = useState(title);
    const [translatedMessage, setTranslatedMessage] = useState(message);
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationStatus, setTranslationStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [showTranslation, setShowTranslation] = useState(false);

    // Traduction automatique au montage
    useEffect(() => {
        if (!autoTranslate) return;

        const translateNotification = async () => {
            setIsTranslating(true);
            setTranslationStatus('idle');

            try {
                const [translatedTitleResult, translatedMessageResult] = await Promise.all([
                    translateText(title, context),
                    translateText(message, context)
                ]);

                if (translatedTitleResult !== title || translatedMessageResult !== message) {
                    setTranslatedTitle(translatedTitleResult);
                    setTranslatedMessage(translatedMessageResult);
                    setTranslationStatus('success');
                }
            } catch (error) {
                console.warn('Erreur traduction notification:', error);
                setTranslationStatus('error');
            } finally {
                setIsTranslating(false);
            }
        };

        translateNotification();
    }, [title, message, autoTranslate, context, translateText]);

    // Auto-fermeture
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose(id);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, id, onClose]);

    const getTypeStyles = () => {
        switch (type) {
            case 'success':
                return {
                    container: 'bg-green-50 border-green-200',
                    icon: 'text-green-600',
                    title: 'text-green-900',
                    message: 'text-green-800'
                };
            case 'error':
                return {
                    container: 'bg-red-50 border-red-200',
                    icon: 'text-red-600',
                    title: 'text-red-900',
                    message: 'text-red-800'
                };
            case 'warning':
                return {
                    container: 'bg-yellow-50 border-yellow-200',
                    icon: 'text-yellow-600',
                    title: 'text-yellow-900',
                    message: 'text-yellow-800'
                };
            case 'info':
            default:
                return {
                    container: 'bg-blue-50 border-blue-200',
                    icon: 'text-blue-600',
                    title: 'text-blue-900',
                    message: 'text-blue-800'
                };
        }
    };

    const getTypeIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5" />;
            case 'error':
                return <AlertCircle className="w-5 h-5" />;
            case 'warning':
                return <AlertCircle className="w-5 h-5" />;
            case 'info':
            default:
                return <CheckCircle className="w-5 h-5" />;
        }
    };

    const styles = getTypeStyles();

    return (
        <div className={`max-w-sm w-full border rounded-lg shadow-lg ${styles.container} animate-in slide-in-from-right-full duration-300`}>
            <div className="p-4">
                {/* Header avec titre et bouton fermer */}
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={styles.icon}>
                            {getTypeIcon()}
                        </div>
                        <h3 className={`font-medium ${styles.title}`}>
                            {translatedTitle}
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Indicateur de traduction */}
                        {autoTranslate && (
                            <div className="flex items-center gap-1">
                                {isTranslating && (
                                    <Globe className="w-4 h-4 text-blue-600 animate-spin" />
                                )}
                                {translationStatus === 'success' && (
                                    <Languages className="w-4 h-4 text-green-600" />
                                )}
                                {translationStatus === 'error' && (
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => onClose(id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Message */}
                <p className={`text-sm ${styles.message} mb-3`}>
                    {translatedMessage}
                </p>

                {/* Actions */}
                {actions.length > 0 && (
                    <div className="flex gap-2 mb-3">
                        {actions.map((action, index) => (
                            <button
                                key={index}
                                onClick={action.onClick}
                                className={`px-3 py-1 text-xs rounded transition-colors ${action.variant === 'primary'
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Toggle pour voir la traduction */}
                {autoTranslate && translationStatus === 'success' && (
                    <button
                        onClick={() => setShowTranslation(!showTranslation)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                    >
                        <Languages className="w-3 h-3" />
                        {showTranslation ? 'Masquer' : 'Voir'} la traduction
                    </button>
                )}

                {/* Texte original si demandé */}
                {showTranslation && (
                    <div className="mt-3 p-2 bg-white bg-opacity-50 rounded border">
                        <p className="text-xs text-gray-600 mb-1">Texte original:</p>
                        <p className="text-xs text-gray-700">
                            <strong>{title}</strong><br />
                            {message}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IntelligentNotification;
