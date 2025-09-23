import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, Shield } from 'lucide-react';
import React from 'react';

interface PaymentMethod {
    id: string;
    name: string;
    icon: React.ReactNode;
    description: string;
    available: boolean;
    processingTime: string;
    fees: number;
}

interface PaymentMethodsProps {
    methods: PaymentMethod[];
    selectedMethod: string;
    onSelectMethod: (methodId: string) => void;
    formatAmount: (amount: number, showCurrency?: boolean) => string;
}

const PaymentMethods: React.FC<PaymentMethodsProps> = ({
    methods,
    selectedMethod,
    onSelectMethod,
    formatAmount
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {methods.map((method) => (
                <Card
                    key={method.id}
                    className={`cursor-pointer transition-all duration-200 ${selectedMethod === method.id
                            ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20'
                            : method.available
                                ? 'hover:border-green-300 hover:shadow-md'
                                : 'opacity-50 cursor-not-allowed'
                        }`}
                    onClick={() => method.available && onSelectMethod(method.id)}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="text-2xl">{method.icon}</div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                    {method.name}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {method.description}
                                </p>
                            </div>
                            {selectedMethod === method.id && (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Temps de traitement:</span>
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{method.processingTime}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Frais:</span>
                                <span className={method.fees === 0 ? 'text-green-600' : 'text-gray-900'}>
                                    {method.fees === 0 ? 'Gratuit' : formatAmount(method.fees)}
                                </span>
                            </div>

                            {method.available && (
                                <div className="flex items-center gap-1 text-xs text-green-600">
                                    <Shield className="h-3 w-3" />
                                    <span>Sécurisé</span>
                                </div>
                            )}

                            {!method.available && (
                                <Badge className="bg-gray-500 text-white text-xs">
                                    Bientôt disponible
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default PaymentMethods;
