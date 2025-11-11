import BudgetAlert from '@/components/delivery/BudgetAlert';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShopping } from '@/context/ShoppingContext';
import formatCurrency from '@/utils/formatCurrency';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ShoppingBudgetPage: React.FC = () => {
    const navigate = useNavigate();
    const { estimate, recipient, setRecipient, refreshBalance, balance } = useShopping();
    const [notes, setNotes] = useState(recipient?.notes ?? '');
    const [contactName, setContactName] = useState(recipient?.contactName ?? '');
    const [contactPhone, setContactPhone] = useState(recipient?.contactPhone ?? '');

    const handleContinue = () => {
        setRecipient({
            ...recipient,
            contactName: contactName || undefined,
            contactPhone: contactPhone || undefined,
            notes: notes || undefined,
        });
        navigate('/delivery/shopping/pickup-drop');
    };

    return (
        <AppLayout>
            <div className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Budget & informations destinataire</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Vérifiez votre solde Yukpo Wallet avant de confirmer la commande.
                    </p>
                </div>

                <BudgetAlert onRecharge={() => navigate('/recharge-tokens')} />

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Récapitulatif estimation</h2>
                    <div className="mt-4 grid gap-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                            <span>Total estimé</span>
                            <span className="font-semibold text-slate-900">
                                {estimate
                                    ? formatCurrency(estimate.estimated_total_cents / 100, estimate.currency)
                                    : '—'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Solde actuel</span>
                            <span>{balance !== undefined ? formatCurrency(balance) : '—'}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Les frais de livraison seront finalisés lors de la validation du coursier.
                        </div>
                    </div>
                </div>

                <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="grid gap-2">
                        <Label htmlFor="contactName">Nom du destinataire (optionnel)</Label>
                        <Input
                            id="contactName"
                            placeholder="Nom et prénom pour la remise"
                            value={contactName}
                            onChange={event => setContactName(event.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="contactPhone">Téléphone destinataire (optionnel)</Label>
                        <Input
                            id="contactPhone"
                            placeholder="+237 6XX XX XX XX"
                            value={contactPhone}
                            onChange={event => setContactPhone(event.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Instructions pour le coursier</Label>
                        <textarea
                            id="notes"
                            rows={4}
                            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Ex : vérifier la maturité des tomates, accepter remplacement par tomates cerises."
                            value={notes}
                            onChange={event => setNotes(event.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => navigate('/delivery/shopping/basket')}>
                        Retour
                    </Button>
                    <Button onClick={handleContinue}>
                        Continuer
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default ShoppingBudgetPage;


