// Composant pour sélectionner et valider les modes de paiement - Frontend
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCardNumber, validateCardExpiry, validateCardNumber, validatePhoneNumber } from '@/utils/paymentValidation';
import { AlertCircle, CheckCircle, CreditCard, Info, Shield, Smartphone } from 'lucide-react';
import React, { useEffect, useState } from 'react';

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

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ onPaymentChange, readonly = false }) => {
    const [selectedType, setSelectedType] = useState<'mobile_money' | 'orange_money' | 'carte_bancaire' | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCVV, setCardCVV] = useState('');
    const [cardHolder, setCardHolder] = useState('');

    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [cardError, setCardError] = useState<string | null>(null);
    const [expiryError, setExpiryError] = useState<string | null>(null);

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
    }, [selectedType, phoneNumber, cardNumber, cardExpiry, cardCVV, cardHolder]);

    const handleCardNumberChange = (text: string) => {
        setCardNumber(formatCardNumber(text));
    };

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
                <h3 className="text-lg font-bold text-gray-900">💳 Mode de paiement</h3>
                <p className="text-sm text-gray-500 mt-1">
                    Sélectionnez votre moyen de paiement préféré pour faciliter les transactions
                </p>
            </div>

            {/* Sélection du type */}
            <div className="grid grid-cols-3 gap-3">
                <button
                    type="button"
                    onClick={() => setSelectedType('mobile_money')}
                    disabled={readonly}
                    className={`relative p-4 rounded-lg border-2 transition-all ${selectedType === 'mobile_money'
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-indigo-300'
                        } ${readonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <div className="text-center">
                        <Smartphone className="w-8 h-8 mx-auto mb-2 text-indigo-600" />
                        <p className={`text-sm font-semibold ${selectedType === 'mobile_money' ? 'text-indigo-600' : 'text-gray-600'}`}>
                            Mobile Money
                        </p>
                    </div>
                    {selectedType === 'mobile_money' && (
                        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-500" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedType('orange_money')}
                    disabled={readonly}
                    className={`relative p-4 rounded-lg border-2 transition-all ${selectedType === 'orange_money'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 bg-white hover:border-orange-300'
                        } ${readonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <div className="text-center">
                        <span className="text-4xl">🍊</span>
                        <p className={`text-sm font-semibold mt-2 ${selectedType === 'orange_money' ? 'text-orange-600' : 'text-gray-600'}`}>
                            Orange Money
                        </p>
                    </div>
                    {selectedType === 'orange_money' && (
                        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-500" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedType('carte_bancaire')}
                    disabled={readonly}
                    className={`relative p-4 rounded-lg border-2 transition-all ${selectedType === 'carte_bancaire'
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-indigo-300'
                        } ${readonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <div className="text-center">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 text-indigo-600" />
                        <p className={`text-sm font-semibold ${selectedType === 'carte_bancaire' ? 'text-indigo-600' : 'text-gray-600'}`}>
                            Carte Bancaire
                        </p>
                    </div>
                    {selectedType === 'carte_bancaire' && (
                        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-green-500" />
                    )}
                </button>
            </div>

            {/* Formulaire Mobile Money / Orange Money */}
            {(selectedType === 'mobile_money' || selectedType === 'orange_money') && (
                <div className="space-y-3">
                    <Label>Numéro de téléphone {selectedType === 'mobile_money' ? 'Mobile Money' : 'Orange Money'}</Label>
                    <p className="text-xs text-gray-500">
                        Entrez votre numéro sans l'indicatif pays (détecté automatiquement)
                    </p>
                    <Input
                        type="tel"
                        placeholder="Ex: 6XX XX XX XX"
                        value={phoneNumber}
                        onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^\d\s]/g, '');
                            setPhoneNumber(cleaned);
                        }}
                        maxLength={15}
                        disabled={readonly}
                        className={phoneError ? 'border-red-500 bg-red-50' : ''}
                    />
                    {phoneError && (
                        <div className="flex items-start gap-2 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p className="whitespace-pre-line">{phoneError}</p>
                        </div>
                    )}
                    {phoneNumber.length > 0 && !phoneError && phoneNumber.length >= 8 && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <p className="font-semibold">✓ Numéro valide</p>
                        </div>
                    )}
                </div>
            )}

            {/* Formulaire Carte Bancaire */}
            {selectedType === 'carte_bancaire' && (
                <div className="space-y-4">
                    <div className="bg-indigo-600 text-white p-3 rounded-lg">
                        <p className="font-semibold">
                            {validateCardNumber(cardNumber.replace(/\s/g, '')).type || 'Carte Bancaire'}
                        </p>
                    </div>

                    <div>
                        <Label>Numéro de carte</Label>
                        <Input
                            type="text"
                            placeholder="XXXX XXXX XXXX XXXX"
                            value={cardNumber}
                            onChange={(e) => handleCardNumberChange(e.target.value)}
                            maxLength={19}
                            disabled={readonly}
                            className={cardError ? 'border-red-500 bg-red-50' : ''}
                        />
                        {cardError && (
                            <div className="flex items-center gap-2 text-red-600 text-sm mt-1">
                                <AlertCircle className="w-4 h-4" />
                                <p>{cardError}</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <Label>Nom du titulaire</Label>
                        <Input
                            type="text"
                            placeholder="JEAN DUPONT"
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                            disabled={readonly}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Expiration</Label>
                            <Input
                                type="text"
                                placeholder="MM/AA"
                                value={cardExpiry}
                                onChange={(e) => handleExpiryChange(e.target.value)}
                                maxLength={5}
                                disabled={readonly}
                                className={expiryError ? 'border-red-500 bg-red-50' : ''}
                            />
                            {expiryError && (
                                <p className="text-xs text-red-600 mt-1">{expiryError}</p>
                            )}
                        </div>

                        <div>
                            <Label>CVV</Label>
                            <Input
                                type="password"
                                placeholder="XXX"
                                value={cardCVV}
                                onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, ''))}
                                maxLength={4}
                                disabled={readonly}
                            />
                        </div>
                    </div>

                    {cardNumber.length >= 13 && !cardError && cardExpiry.length >= 5 && !expiryError && cardCVV.length >= 3 && cardHolder.length > 0 && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <p className="font-semibold">✓ Informations de carte valides</p>
                        </div>
                    )}
                </div>
            )}

            {/* Message informatif */}
            {!selectedType && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-700">
                        Sélectionnez un mode de paiement pour faciliter les transactions avec vos clients
                    </p>
                </div>
            )}

            {/* Sécurité */}
            {selectedType && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                    <Shield className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-green-700 font-medium">
                        🔒 Vos informations de paiement sont sécurisées et cryptées
                    </p>
                </div>
            )}
        </div>
    );
};

export default PaymentMethodSelector;

