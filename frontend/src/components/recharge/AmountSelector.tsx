import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/buttons/Button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  Zap, 
  Star, 
  TrendingUp, 
  Calculator,
  Gift
} from 'lucide-react';

interface RechargeOption {
  id: string;
  amount: number;
  tokens: number;
  bonus: number;
  popular?: boolean;
  savings?: number;
}

interface AmountSelectorProps {
  options: RechargeOption[];
  selectedOption: string | null;
  onSelectOption: (optionId: string) => void;
  customAmount: number;
  onCustomAmountChange: (amount: number) => void;
  formatAmount: (amount: number) => string;
  currency: string;
}

const AmountSelector: React.FC<AmountSelectorProps> = ({
  options,
  selectedOption,
  onSelectOption,
  customAmount,
  onCustomAmountChange,
  formatAmount,
  currency
}) => {
  const [showCustom, setShowCustom] = useState(false);

  const handleCustomAmountChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    onCustomAmountChange(amount);
  };

  const calculateTokens = (amount: number) => {
    // 1 FCFA = 1 token (base)
    return Math.floor(amount);
  };

  const calculateBonus = (amount: number) => {
    if (amount >= 10000) return Math.floor(amount * 0.2); // 20% bonus
    if (amount >= 5000) return Math.floor(amount * 0.1);  // 10% bonus
    if (amount >= 2000) return Math.floor(amount * 0.05); // 5% bonus
    return 0;
  };

  const customTokens = calculateTokens(customAmount);
  const customBonus = calculateBonus(customAmount);

  return (
    <div className="space-y-6">
      {/* Options prédéfinies */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Montants recommandés</h3>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Star className="w-3 h-3 mr-1" />
            Populaire
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {options.map((option) => (
            <Card
              key={option.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedOption === option.id
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : 'hover:shadow-md'
              } ${option.popular ? 'border-blue-200' : ''}`}
              onClick={() => onSelectOption(option.id)}
            >
              <CardContent className="p-6">
                <div className="text-center">
                  {option.popular && (
                    <div className="flex justify-center mb-2">
                      <Badge className="bg-orange-500 text-white">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Populaire
                      </Badge>
                    </div>
                  )}
                  
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {formatAmount(option.amount)}
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="text-lg font-semibold text-blue-600">
                      {option.tokens.toLocaleString()} tokens
                    </span>
                  </div>
                  
                  {option.bonus > 0 && (
                    <div className="flex items-center justify-center gap-1 text-green-600 text-sm">
                      <Gift className="w-3 h-3" />
                      <span>+{option.bonus.toLocaleString()} bonus</span>
                    </div>
                  )}
                  
                  {option.savings && (
                    <div className="text-xs text-green-600 mt-1">
                      Économisez {formatAmount(option.savings)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Montant personnalisé */}
      <Card className="border-2 border-dashed border-gray-200 hover:border-blue-300 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Montant personnalisé</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Montant en {currency}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="1000"
                  step="100"
                  value={customAmount || ''}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  placeholder="Entrez votre montant"
                  className="text-lg pr-12"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  {currency}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Minimum: {formatAmount(1000)}
              </p>
            </div>
            
            {customAmount >= 1000 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-sm text-gray-600">Tokens</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {customTokens.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Bonus</div>
                    <div className="text-lg font-semibold text-green-600">
                      +{customBonus.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <div className="text-sm text-gray-600">Total</div>
                  <div className="text-xl font-bold text-gray-900">
                    {(customTokens + customBonus).toLocaleString()} tokens
                  </div>
                </div>
              </div>
            )}
            
            <Button
              onClick={() => onSelectOption('custom')}
              disabled={customAmount < 1000}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {customAmount >= 1000 ? 'Sélectionner ce montant' : 'Montant insuffisant'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AmountSelector;
