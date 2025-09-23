import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, History, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';

interface HistoryItem {
    id: string;
    date: string;
    service: string;
    amount: number;
    type: 'consumption' | 'recharge';
    description: string;
}

interface HistorySummaryProps {
    consumptionHistory: HistoryItem[];
    paymentHistory: any[];
    formatAmount: (amount: number, showCurrency?: boolean) => string;
    onViewFullHistory: () => void;
}

const HistorySummary: React.FC<HistorySummaryProps> = ({
    consumptionHistory,
    paymentHistory,
    formatAmount,
    onViewFullHistory
}) => {
    const recentConsumption = consumptionHistory.slice(0, 3);
    const recentPayments = paymentHistory.slice(0, 3);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Historique des consommations */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingDown className="h-5 w-5 text-red-500" />
                        Consommations récentes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {recentConsumption.length > 0 ? (
                        <div className="space-y-3">
                            {recentConsumption.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.type === 'consumption' ? 'bg-red-100' : 'bg-green-100'
                                            }`}>
                                            {item.type === 'consumption' ? (
                                                <TrendingDown className="w-4 h-4 text-red-600" />
                                            ) : (
                                                <TrendingUp className="w-4 h-4 text-green-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                {item.service}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(item.date).toLocaleDateString('fr-FR')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`font-semibold text-sm ${item.type === 'consumption' ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                        {item.type === 'consumption' ? '-' : '+'}{formatAmount(item.amount, false)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-gray-500">
                            <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">Aucune consommation récente</p>
                        </div>
                    )}

                    {consumptionHistory.length > 3 && (
                        <Button
                            variant="outline"
                            onClick={onViewFullHistory}
                            className="w-full mt-3 flex items-center gap-2"
                        >
                            Voir tout l'historique
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Historique des paiements */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        Paiements récents
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {recentPayments.length > 0 ? (
                        <div className="space-y-3">
                            {recentPayments.map((payment) => (
                                <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${payment.status === 'completed' ? 'bg-green-100' :
                                                payment.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                                            }`}>
                                            <TrendingUp className="w-4 h-4 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                {payment.description}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(payment.date).toLocaleDateString('fr-FR')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                            {formatAmount(payment.amount, false)}
                                        </div>
                                        <Badge className={`text-xs ${payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {payment.status === 'completed' ? 'Complété' :
                                                payment.status === 'pending' ? 'En attente' : 'Échoué'}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-gray-500">
                            <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">Aucun paiement récent</p>
                        </div>
                    )}

                    {paymentHistory.length > 3 && (
                        <Button
                            variant="outline"
                            onClick={onViewFullHistory}
                            className="w-full mt-3 flex items-center gap-2"
                        >
                            Voir tout l'historique
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default HistorySummary;
