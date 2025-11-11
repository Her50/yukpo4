import ShoppingBasketTable from '@/components/delivery/ShoppingBasketTable';
import ShoppingItemForm from '@/components/delivery/ShoppingItemForm';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { useShopping } from '@/context/ShoppingContext';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ShoppingBasketPage: React.FC = () => {
    const navigate = useNavigate();
    const { items, refreshEstimate, estimate, lastError } = useShopping();

    useEffect(() => {
        if (items.length) {
            refreshEstimate();
        }
    }, [items, refreshEstimate]);

    return (
        <AppLayout>
            <div className="mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Définissez votre panier</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Ajoutez les produits et quantités à récupérer par le coursier. Vous pourrez préciser le budget et les adresses aux étapes suivantes.
                    </p>
                </div>

                <ShoppingItemForm />

                <div className="space-y-4">
                    <ShoppingBasketTable />
                    {lastError ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                            {lastError}
                        </div>
                    ) : null}
                    {estimate ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            Estimation Yukpo : {(estimate.estimated_total_cents / 100).toLocaleString('fr-FR')} {estimate.currency} — temps d’achat estimé {estimate.estimated_shopping_time_minutes} min.
                        </div>
                    ) : null}
                </div>

                <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => navigate('/delivery')}>
                        Retour
                    </Button>
                    <Button
                        disabled={!items.length}
                        onClick={() => navigate('/delivery/shopping/budget')}
                    >
                        Continuer
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default ShoppingBasketPage;


