import React, { useState } from 'react';
import { X, Smartphone, CreditCard, Building2 } from 'lucide-react';
import PaymentMethodIcons from './PaymentMethodIcons';
import { Button } from '../ui/buttons/Button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (method: any) => void;
}

const AddPaymentMethodModal: React.FC<AddPaymentMethodModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [selectedType, setSelectedType] = useState<'mobile' | 'card' | 'bank'>('mobile');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  const mobileProviders = [
    { id: 'mtn', name: 'MTN Mobile Money', icon: 'mtn' },
    { id: 'orange', name: 'Orange Money', icon: 'orange' },
    { id: 'moov', name: 'Moov Money', icon: 'moov' }
  ];

  const cardProviders = [
    { id: 'visa', name: 'Visa', icon: 'visa' },
    { id: 'mastercard', name: 'Mastercard', icon: 'mastercard' }
  ];

  const bankProviders = [
    { id: 'bank', name: 'Virement bancaire', icon: 'bank' }
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      let methodData: any = {
        type: selectedType,
        isDefault,
        provider: selectedProvider
      };

      if (selectedType === 'mobile') {
        if (!phoneNumber || !selectedProvider) {
          alert('Veuillez remplir tous les champs requis');
          setLoading(false);
          return;
        }
        methodData = {
          ...methodData,
          name: mobileProviders.find(p => p.id === selectedProvider)?.name || '',
          details: `*** *** ${phoneNumber.slice(-4)}`,
          phoneNumber
        };
      } else if (selectedType === 'card') {
        if (!cardNumber || !expiryDate || !cvv || !cardholderName || !selectedProvider) {
          alert('Veuillez remplir tous les champs requis');
          setLoading(false);
          return;
        }
        methodData = {
          ...methodData,
          name: `${cardProviders.find(p => p.id === selectedProvider)?.name} **** ${cardNumber.slice(-4)}`,
          details: `**** **** **** ${cardNumber.slice(-4)}`,
          cardNumber,
          expiryDate,
          cvv,
          cardholderName
        };
      } else if (selectedType === 'bank') {
        if (!bankAccount) {
          alert('Veuillez remplir tous les champs requis');
          setLoading(false);
          return;
        }
        methodData = {
          ...methodData,
          name: 'Virement bancaire',
          details: `Compte: ${bankAccount}`,
          bankAccount
        };
      }

      // Pour l'instant, simuler la sauvegarde car l'API n'existe pas encore
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Vous devez être connecté pour ajouter un moyen de paiement');
        setLoading(false);
        return;
      }

      // Simulation de la sauvegarde
      console.log('Simulation de la sauvegarde du moyen de paiement:', methodData);
      
      // Créer un objet simulé avec un ID
      const savedMethod = {
        id: Date.now().toString(),
        ...methodData,
        lastUsed: new Date().toISOString().split('T')[0]
      };
      
      console.log('Moyen de paiement simulé sauvegardé:', savedMethod);
      
      onSave(savedMethod);
      onClose();
      
      // TODO: Remplacer par un vrai appel API quand l'endpoint sera disponible
      /*
      const response = await fetch('https://yukpomnang.onrender.com/api/users/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(methodData)
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      const savedMethod = await response.json();
      console.log('Moyen de paiement sauvegardé:', savedMethod);
      
      onSave(savedMethod);
      onClose();
      */
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du moyen de paiement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Ajouter un moyen de paiement</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Type de paiement */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Type de paiement</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={selectedType === 'mobile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('mobile')}
                className="flex flex-col items-center space-y-1 h-auto py-3"
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-xs">Mobile</span>
              </Button>
              <Button
                variant={selectedType === 'card' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('card')}
                className="flex flex-col items-center space-y-1 h-auto py-3"
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-xs">Carte</span>
              </Button>
              <Button
                variant={selectedType === 'bank' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('bank')}
                className="flex flex-col items-center space-y-1 h-auto py-3"
              >
                <Building2 className="w-5 h-5" />
                <span className="text-xs">Banque</span>
              </Button>
            </div>
          </div>

          {/* Fournisseur */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Fournisseur</Label>
            <div className="grid grid-cols-1 gap-2">
              {(selectedType === 'mobile' ? mobileProviders : 
                selectedType === 'card' ? cardProviders : bankProviders).map((provider) => (
                <Button
                  key={provider.id}
                  variant={selectedProvider === provider.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedProvider(provider.id)}
                  className="flex items-center space-x-2 justify-start"
                >
                  <PaymentMethodIcons method={provider.icon} className="w-4 h-4" />
                  <span>{provider.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Champs spécifiques */}
          {selectedType === 'mobile' && (
            <div className="space-y-3">
              <Label htmlFor="phoneNumber" className="text-sm font-medium">
                Numéro de téléphone
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+237 6XX XXX XXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {selectedType === 'card' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cardNumber" className="text-sm font-medium">
                  Numéro de carte
                </Label>
                <Input
                  id="cardNumber"
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="expiryDate" className="text-sm font-medium">
                    Date d'expiration
                  </Label>
                  <Input
                    id="expiryDate"
                    type="text"
                    placeholder="MM/AA"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="cvv" className="text-sm font-medium">
                    CVV
                  </Label>
                  <Input
                    id="cvv"
                    type="text"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="cardholderName" className="text-sm font-medium">
                  Nom du titulaire
                </Label>
                <Input
                  id="cardholderName"
                  type="text"
                  placeholder="Jean Dupont"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {selectedType === 'bank' && (
            <div className="space-y-3">
              <Label htmlFor="bankAccount" className="text-sm font-medium">
                Numéro de compte
              </Label>
              <Input
                id="bankAccount"
                type="text"
                placeholder="1234567890"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {/* Définir par défaut */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isDefault" className="text-sm">
              Définir comme moyen de paiement par défaut
            </Label>
          </div>

          {/* Boutons d'action */}
          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddPaymentMethodModal;
