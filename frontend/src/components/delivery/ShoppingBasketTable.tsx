import { Button } from '@/components/ui/buttons/Button';
import { useShopping } from '@/context/ShoppingContext';
import { formatCurrency } from '@/utils/formatCurrency';
import React from 'react';

export const ShoppingBasketTable: React.FC = () => {
    const { items, removeItem, updateItem } = useShopping();

    const handleQuantityChange = (id: string, quantity: number) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        updateItem({ ...item, quantity: Math.max(1, quantity) });
    };

    if (!items.length) {
        return (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Aucun article pour le moment. Ajoutez vos produits à l’aide du formulaire ci-dessus.
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                        <th className="px-4 py-3">Produit</th>
                        <th className="px-4 py-3 w-32">Quantité</th>
                        <th className="px-4 py-3 w-32">Unité</th>
                        <th className="px-4 py-3 w-40 text-right">Prix estimé</th>
                        <th className="px-4 py-3 w-20" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map(item => (
                        <tr key={item.id}>
                            <td className="px-4 py-3 font-medium text-slate-700">{item.productName}</td>
                            <td className="px-4 py-3">
                                <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={event => handleQuantityChange(item.id, Number(event.target.value) || 1)}
                                    className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                                />
                            </td>
                            <td className="px-4 py-3 text-slate-600">{item.unit}</td>
                            <td className="px-4 py-3 text-right text-slate-700">
                                {item.estimatedPriceCents
                                    ? formatCurrency(item.estimatedPriceCents / 100)
                                    : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(item.id)}
                                >
                                    Retirer
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ShoppingBasketTable;


