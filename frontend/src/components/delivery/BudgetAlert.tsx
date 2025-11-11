import { Button } from '@/components/ui/buttons/Button';
import { useShopping } from '@/context/ShoppingContext';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import formatCurrency from '@/utils/formatCurrency';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import React, { useMemo } from 'react';

interface BudgetAlertProps {
    onRecharge?: () => void;
}

export const BudgetAlert: React.FC<BudgetAlertProps> = ({ onRecharge }) => {
    const { estimate } = useShopping();
    const { balance, refresh, loading } = useWalletBalance();

    const totalEstimated = estimate?.estimated_total_cents
        ? estimate.estimated_total_cents / 100
        : 0;

    const { canProceed, missing } = useMemo(() => {
        if (balance === undefined) {
            return { canProceed: false, missing: 0 };
        }
        const missingAmount = Math.max(0, totalEstimated - balance);
        return {
            canProceed: missingAmount === 0,
            missing: missingAmount,
        };
    }, [balance, totalEstimated]);

    if (balance === undefined) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span>Solde indisponible. Actualisez pour consulter votre portefeuille Yukpo.</span>
                <Button size="sm" variant="outline" loading={loading} onClick={refresh}>
                    Actualiser
                </Button>
            </div>
        );
    }

    return (
        <div
            className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${canProceed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
        >
            <div className="flex flex-1 items-start gap-3">
                {canProceed ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
                )}
                <div>
                    <p className="font-medium">
                        Solde Yukpo Wallet : {formatCurrency(balance)} — estimation panier {formatCurrency(totalEstimated)}
                    </p>
                    {canProceed ? (
                        <p className="text-emerald-600">
                            Budget suffisant pour lancer la commande.
                        </p>
                    ) : (
                        <p className="text-amber-600">
                            Il manque {formatCurrency(missing)} pour valider la commande. Recharge ton portefeuille.
                        </p>
                    )}
                </div>
            </div>
            {!canProceed && (
                <Button size="sm" variant="secondary" onClick={onRecharge}>
                    Recharger
                </Button>
            )}
        </div>
    );
};

export default BudgetAlert;


