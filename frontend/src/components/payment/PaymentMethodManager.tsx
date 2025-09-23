import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/buttons/Button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  CreditCard, 
  Smartphone, 
  Plus, 
  Edit, 
  Trash2, 
  Check,
  Shield,
  Lock
} from 'lucide-react';

interface PaymentMethod {
  id: string;
  type: 'card' | 'mobile' | 'bank';
  name: string;
  last4?: string;
  phone?: string;
  bank?: string;
  isDefault: boolean;
  isVerified: boolean;
}

const PaymentMethodManager: React.FC = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Types de moyens de paiement disponibles
  const availableTypes = [
    {
      type: 'card' as const,
      name: 'Carte bancaire',
      icon: CreditCard,
      description: 'Visa, Mastercard, American Express'
    },
    {
      type: 'mobile' as const,
      name: 'Mobile Money',
      icon: Smartphone,
      description: 'MTN Money, Orange Money, Moov Money'
    },
    {
      type: 'bank' as const,
      name: 'Virement bancaire',
      icon: Shield,
      description: 'Transfert direct depuis votre banque'
    }
  ];

  const loadPaymentMethods = async () => {
    setLoading(true);
    try {
      // Simuler le chargement des moyens de paiement
      const mockMethods: PaymentMethod[] = [
        {
          id: '1',
          type: 'card',
          name: 'Carte Visa',
          last4: '4242',
          isDefault: true,
          isVerified: true
        },
        {
          id: '2',
          type: 'mobile',
          name: 'MTN Money',
          phone: '+237 6XX XXX XXX',
          isDefault: false,
          isVerified: true
        }
      ];
      setMethods(mockMethods);
    } catch (error) {
      console.error('Erreur chargement moyens de paiement:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const handleAddMethod = (type: PaymentMethod['type']) => {
    setEditingMethod('new');
    setShowAddForm(true);
  };

  const handleEditMethod = (methodId: string) => {
    setEditingMethod(methodId);
    setShowAddForm(true);
  };

  const handleDeleteMethod = async (methodId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce moyen de paiement ?')) {
      setMethods(prev => prev.filter(m => m.id !== methodId));
    }
  };

  const handleSetDefault = async (methodId: string) => {
    setMethods(prev => prev.map(m => ({
      ...m,
      isDefault: m.id === methodId
    })));
  };

  const getMethodIcon = (type: PaymentMethod['type']) => {
    const methodType = availableTypes.find(t => t.type === type);
    return methodType ? methodType.icon : CreditCard;
  };

  const getMethodDisplay = (method: PaymentMethod) => {
    switch (method.type) {
      case 'card':
        return `**** **** **** ${method.last4}`;
      case 'mobile':
        return method.phone || 'Mobile Money';
      case 'bank':
        return method.bank || 'Compte bancaire';
      default:
        return method.name;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Moyens de paiement</h3>
          <p className="text-sm text-gray-600">Gérez vos moyens de paiement pour des recharges rapides</p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {/* Liste des moyens de paiement */}
      <div className="grid gap-4">
        {methods.map((method) => {
          const Icon = getMethodIcon(method.type);
          return (
            <Card key={method.id} className={`relative ${method.isDefault ? 'ring-2 ring-blue-500' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{method.name}</span>
                        {method.isDefault && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            Par défaut
                          </span>
                        )}
                        {method.isVerified && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{getMethodDisplay(method)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {!method.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        Définir par défaut
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditMethod(method.id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteMethod(method.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Types de moyens de paiement disponibles */}
      <div>
        <h4 className="text-md font-medium mb-4">Ajouter un nouveau moyen de paiement</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {availableTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Card 
                key={type.type}
                className="cursor-pointer hover:shadow-md transition-shadow border-2 border-dashed border-gray-200 hover:border-blue-300"
                onClick={() => handleAddMethod(type.type)}
              >
                <CardContent className="p-6 text-center">
                  <div className="p-3 bg-gray-100 rounded-full w-fit mx-auto mb-3">
                    <Icon className="w-6 h-6 text-gray-600" />
                  </div>
                  <h5 className="font-medium mb-1">{type.name}</h5>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Sécurité */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-green-600" />
            <div>
              <h5 className="font-medium text-green-900">Sécurité garantie</h5>
              <p className="text-sm text-green-700">
                Tous vos moyens de paiement sont chiffrés et sécurisés. 
                Nous ne stockons jamais vos informations sensibles.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentMethodManager;
