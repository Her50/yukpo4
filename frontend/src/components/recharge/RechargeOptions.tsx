import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Zap } from 'lucide-react';
import React from 'react';

interface RechargeOption {
    id: string;
    amount: number;
    tokens: number;
    bonus: number;
    popular?: boolean;
    description: string;
}

interface RechargeOptionsProps {
    options: RechargeOption[];
    selectedOption: string;
    onSelectOption: (optionId: string) => void;
    formatAmount: (amount: number, showCurrency?: boolean) => string;
}

const RechargeOptions: React.FC<RechargeOptionsProps> = ({
    options,
    selectedOption,
    onSelectOption,
    formatAmount
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {options.map((option) => (
                <Card
                    key={option.id}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${selectedOption === option.id
                            ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:border-blue-300'
                        }`}
                    onClick={() => onSelectOption(option.id)}
                >
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-yellow-500" />
                                <span className="font-semibold text-lg">
                                    {formatAmount(option.amount)}
                                </span>
                            </div>
                            {option.popular && (
                                <Badge className="bg-orange-500 text-white flex items-center gap-1">
                                    <Star className="h-3 w-3" />
                                    Populaire
                                </Badge>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Tokens:</span>
                                <span className="font-semibold text-blue-600">
                                    {option.tokens.toLocaleString()}
                                </span>
                            </div>

                            {option.bonus > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Bonus:</span>
                                    <span className="font-semibold text-green-600">
                                        +{option.bonus.toLocaleString()}
                                    </span>
                                </div>
                            )}

                            <div className="pt-2 border-t">
                                <p className="text-sm text-gray-500">
                                    {option.description}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default RechargeOptions;
