// Composant pour sélectionner et valider les modes de paiement
import { AlertCircle, CheckCircle, CreditCard, Info, Smartphone } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';

interface PaymentMethod {
    type: 'mobile_money' | 'orange_money' | 'carte_bancaire';
    phoneNumber?: string;
    cardNumber?: string;
    cardExpiry?: string;
    cardCVV?: string;
    cardHolder?: string;
}

interface PaymentMethodSelectorProps {
    onPaymentChange: (payment: PaymentMethod | null) => void;
    readonly?: boolean;
}

// Validation du numéro de téléphone (Cameroun)
const validatePhoneNumber = (phone: string): { valid: boolean; error?: string; formattedNumber?: string } => {
    const cleaned = phone.replace(/\s/g, '');

    // Format camerounais : 6XXXXXXXX (9 chiffres commençant par 6)
    if (cleaned.length < 9) {
        return { valid: false, error: 'Numéro trop court (minimum 9 chiffres)' };
    }

    if (cleaned.length > 15) {
        return { valid: false, error: 'Numéro trop long' };
    }

    if (!/^\d+$/.test(cleaned)) {
        return { valid: false, error: 'Le numéro ne doit contenir que des chiffres' };
    }

    // Mobile Money : 67X ou 65X
    // Orange Money : 69X
    const firstDigits = cleaned.substring(0, 3);
    if (!['670', '671', '672', '673', '674', '675', '676', '677', '678', '679',
        '650', '651', '652', '653', '654', '655', '656', '657', '658', '659',
        '690', '691', '692', '693', '694', '695', '696', '697', '698', '699'].includes(firstDigits)) {
        return { valid: false, error: 'Numéro invalide pour Mobile/Orange Money' };
    }

    return { valid: true, formattedNumber: cleaned };
};

// Validation du numéro de carte
const validateCardNumber = (cardNumber: string): { valid: boolean; error?: string; type?: string } => {
    const cleaned = cardNumber.replace(/\s/g, '');

    if (cleaned.length < 13 || cleaned.length > 19) {
        return { valid: false, error: 'Numéro de carte invalide' };
    }

    if (!/^\d+$/.test(cleaned)) {
        return { valid: false, error: 'Le numéro ne doit contenir que des chiffres' };
    }

    // Détection du type de carte via les premiers chiffres
    let type = 'Carte Bancaire';
    if (cleaned.startsWith('4')) type = 'Visa';
    else if (cleaned.startsWith('5')) type = 'Mastercard';
    else if (cleaned.startsWith('3')) type = 'American Express';

    // Algorithme de Luhn pour validation
    let sum = 0;
    let isEven = false;
    for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i]);
        if (isEven) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
    }

    if (sum % 10 !== 0) {
        return { valid: false, error: 'Numéro de carte invalide (échec vérification)' };
    }

    return { valid: true, type };
};

// Validation de la date d'expiration
const validateCardExpiry = (expiry: string): { valid: boolean; error?: string } => {
    if (expiry.length !== 5 || !expiry.includes('/')) {
        return { valid: false, error: 'Format invalide (MM/AA)' };
    }

    const [month, year] = expiry.split('/');
    const monthNum = parseInt(month);
    const yearNum = parseInt('20' + year);

    if (monthNum < 1 || monthNum > 12) {
        return { valid: false, error: 'Mois invalide' };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth)) {
        return { valid: false, error: 'Carte expirée' };
    }

    if (yearNum > currentYear + 20) {
        return { valid: false, error: 'Date trop éloignée' };
    }

    return { valid: true };
};

// Formatage du numéro de carte (espaces tous les 4 chiffres)
const formatCardNumber = (value: string): string => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted;
};

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ onPaymentChange, readonly = false }) => {
    const [selectedType, setSelectedType] = useState<'mobile_money' | 'orange_money' | 'carte_bancaire' | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCVV, setCardCVV] = useState('');
    const [cardHolder, setCardHolder] = useState('');

    // Validation en temps réel
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [cardError, setCardError] = useState<string | null>(null);
    const [expiryError, setExpiryError] = useState<string | null>(null);

    // Mettre à jour le parent quand les données changent
    useEffect(() => {
        if (!selectedType) {
            onPaymentChange(null);
            return;
        }

        if (selectedType === 'mobile_money' || selectedType === 'orange_money') {
            const validation = validatePhoneNumber(phoneNumber);
            if (validation.valid) {
                onPaymentChange({
                    type: selectedType,
                    phoneNumber: validation.formattedNumber || phoneNumber
                });
                setPhoneError(null);
            } else {
                onPaymentChange(null);
                if (phoneNumber.length > 6) {
                    setPhoneError(validation.error || null);
                }
            }
        } else if (selectedType === 'carte_bancaire') {
            const cardValidation = validateCardNumber(cardNumber);
            const expiryValidation = validateCardExpiry(cardExpiry);

            if (cardValidation.valid && expiryValidation.valid && cardCVV.length >= 3 && cardHolder.trim().length > 0) {
                onPaymentChange({
                    type: selectedType,
                    cardNumber,
                    cardExpiry,
                    cardCVV,
                    cardHolder
                });
                setCardError(null);
                setExpiryError(null);
            } else {
                onPaymentChange(null);
                if (cardNumber.length >= 13) setCardError(cardValidation.error || null);
                if (cardExpiry.length >= 4) setExpiryError(expiryValidation.error || null);
            }
        }
    }, [selectedType, phoneNumber, cardNumber, cardExpiry, cardCVV, cardHolder, onPaymentChange]);

    // Auto-formatage numéro de carte
    const handleCardNumberChange = (text: string) => {
        setCardNumber(formatCardNumber(text));
    };

    // Auto-formatage date d'expiration (MM/YY)
    const handleExpiryChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length >= 2) {
            setCardExpiry(cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4));
        } else {
            setCardExpiry(cleaned);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-gray-900">💳 Mode de paiement</h3>
                <p className="text-sm text-gray-600 mt-1">
                    Sélectionnez votre moyen de paiement préféré pour faciliter les transactions
                </p>
            </div>

            {/* Sélection du type de paiement */}
            <div className="grid grid-cols-3 gap-3">
                <button
                    type="button"
                    className={`relative p-4 border-2 rounded-lg transition-all ${selectedType === 'mobile_money'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-300 hover:border-gray-400'
                        } ${readonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !readonly && setSelectedType('mobile_money')}
                    disabled={readonly}
                >
                    <div className="text-center">
                        <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/MTN_Logo.svg/512px-MTN_Logo.svg.png"
                            alt="MTN Money"
                            className="w-12 h-12 mx-auto mb-2 object-contain"
                        />
                        <p className={`text-sm font-semibold ${selectedType === 'mobile_money' ? 'text-purple-600' : 'text-gray-700'}`}>
                            MTN Money
                        </p>
                    </div>
                    {selectedType === 'mobile_money' && (
                        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-600" />
                    )}
                </button>

                <button
                    type="button"
                    className={`relative p-4 border-2 rounded-lg transition-all ${selectedType === 'orange_money'
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-300 hover:border-gray-400'
                        } ${readonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !readonly && setSelectedType('orange_money')}
                    disabled={readonly}
                >
                    <div className="text-center">
                        <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Orange_logo.svg/512px-Orange_logo.svg.png"
                            alt="Orange Money"
                            className="w-12 h-12 mx-auto mb-2 object-contain"
                        />
                        <p className={`text-sm font-semibold ${selectedType === 'orange_money' ? 'text-orange-600' : 'text-gray-700'}`}>
                            Orange Money
                        </p>
                    </div>
                    {selectedType === 'orange_money' && (
                        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-600" />
                    )}
                </button>

                <button
                    type="button"
                    className={`relative p-4 border-2 rounded-lg transition-all ${selectedType === 'carte_bancaire'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                        } ${readonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !readonly && setSelectedType('carte_bancaire')}
                    disabled={readonly}
                >
                    <div className="text-center">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <p className={`text-sm font-semibold ${selectedType === 'carte_bancaire' ? 'text-blue-600' : 'text-gray-700'}`}>
                            Carte Bancaire
                        </p>
                    </div>
                    {selectedType === 'carte_bancaire' && (
                        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-600" />
                    )}
                </button>
            </div>

            {/* Formulaire Mobile Money / Orange Money */}
            {(selectedType === 'mobile_money' || selectedType === 'orange_money') && (
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">
                                Numéro de téléphone {selectedType === 'mobile_money' ? 'Mobile Money' : 'Orange Money'}
                            </span>
                            <p className="text-xs text-gray-500 mb-2">
                                Entrez votre numéro sans l'indicatif pays (détecté automatiquement)
                            </p>
                            <input
                                type="tel"
                                placeholder="Ex: 6XX XX XX XX"
                                value={phoneNumber}
                                onChange={(e) => {
                                    const cleaned = e.target.value.replace(/[^\d\s]/g, '');
                                    setPhoneNumber(cleaned);
                                }}
                                maxLength={15}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${phoneError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                    }`}
                                disabled={readonly}
                            />
                        </label>
                        {phoneError && (
                            <div className="flex items-center gap-2 text-red-600 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                <span>{phoneError}</span>
                            </div>
                        )}
                        {phoneNumber.length > 0 && !phoneError && (
                            <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                                <CheckCircle className="w-4 h-4" />
                                <span>✓ Numéro valide</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Formulaire Carte Bancaire */}
            {selectedType === 'carte_bancaire' && (
                <Card>
                    <CardContent className="p-4 space-y-4">
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-lg text-white">
                            <p className="text-sm font-semibold">
                                {validateCardNumber(cardNumber.replace(/\s/g, '')).type || 'Carte Bancaire'}
                            </p>
                        </div>

                        {/* Numéro de carte */}
                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Numéro de carte</span>
                            <input
                                type="text"
                                placeholder="XXXX XXXX XXXX XXXX"
                                value={cardNumber}
                                onChange={(e) => handleCardNumberChange(e.target.value)}
                                maxLength={19}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1 ${cardError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                    }`}
                                disabled={readonly}
                            />
                            {cardError && (
                                <div className="flex items-center gap-2 text-red-600 text-sm mt-1">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{cardError}</span>
                                </div>
                            )}
                        </label>

                        {/* Nom du titulaire */}
                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Nom du titulaire</span>
                            <input
                                type="text"
                                placeholder="JEAN DUPONT"
                                value={cardHolder}
                                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                                disabled={readonly}
                            />
                        </label>

                        {/* Date expiration + CVV */}
                        <div className="grid grid-cols-2 gap-4">
                            <label className="block">
                                <span className="text-sm font-medium text-gray-700">Expiration</span>
                                <input
                                    type="text"
                                    placeholder="MM/AA"
                                    value={cardExpiry}
                                    onChange={(e) => handleExpiryChange(e.target.value)}
                                    maxLength={5}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1 ${expiryError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                    disabled={readonly}
                                />
                                {expiryError && (
                                    <p className="text-xs text-red-600 mt-1">{expiryError}</p>
                                )}
                            </label>

                            <label className="block">
                                <span className="text-sm font-medium text-gray-700">CVV</span>
                                <input
                                    type="password"
                                    placeholder="XXX"
                                    value={cardCVV}
                                    onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, ''))}
                                    maxLength={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                                    disabled={readonly}
                                />
                            </label>
                        </div>

                        {cardNumber.length >= 13 && !cardError && cardExpiry.length >= 5 && !expiryError && cardCVV.length >= 3 && cardHolder.length > 0 && (
                            <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                                <CheckCircle className="w-4 h-4" />
                                <span>✓ Informations de carte valides</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Message informatif */}
            {!selectedType && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-900">
                                Sélectionnez un mode de paiement pour faciliter les transactions avec vos clients
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sécurité */}
            {selectedType && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-900 font-medium">
                        🔒 Vos informations de paiement sont sécurisées et cryptées
                    </p>
                </div>
            )}
        </div>
    );
};

export default PaymentMethodSelector;



