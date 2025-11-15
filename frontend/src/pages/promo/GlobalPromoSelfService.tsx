import React, { useState } from 'react';

import RequireAccess from '@/components/auth/RequireAccess';
import AppLayout from '@/components/layout/AppLayout';
import { useMyGlobalPromos } from '@/hooks/useMyGlobalPromos';
import type { UpsertGlobalPromoEntryPayload } from '@/types/globalPromo';

const GlobalPromoSelfServicePage: React.FC = () => {
    const {
        events,
        entries,
        selectedEvent,
        loading,
        submitting,
        error,
        selectEvent,
        submitEntry,
    } = useMyGlobalPromos();

    const [form, setForm] = useState<{
        serviceId: string;
        promoPriceCfa: string;
        discountPercentage: string;
        stockCap: string;
        availability: 'online' | 'live' | 'both';
        note: string;
    }>({
        serviceId: '',
        promoPriceCfa: '',
        discountPercentage: '',
        stockCap: '',
        availability: 'online',
        note: '',
    });

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedEvent) return;

        const payload: UpsertGlobalPromoEntryPayload = {
            serviceId: Number(form.serviceId),
            promoPriceCfa: form.promoPriceCfa ? Number(form.promoPriceCfa) : undefined,
            discountPercentage: form.discountPercentage ? Number(form.discountPercentage) : undefined,
            stockCap: form.stockCap ? Number(form.stockCap) : undefined,
            availability: form.availability,
            metadata: {
                note: form.note,
            },
        };

        await submitEntry(payload);
        setForm((prev) => ({ ...prev, promoPriceCfa: '', discountPercentage: '', stockCap: '', note: '' }));
    };

    return (
        <RequireAccess role="user">
            <AppLayout>
                <div className="mx-auto max-w-5xl px-4 py-10">
                    <header className="mb-8 rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-500 p-6 text-white shadow-lg">
                        <p className="text-sm uppercase tracking-wide">Campagne officielle Yukpo</p>
                        <h1 className="mt-2 text-3xl font-bold">Black Friday fédéré</h1>
                        <p className="mt-2 text-sm text-indigo-100">
                            Proposez vos services à la campagne globale Yukpo. Les équipes valident puis publient en
                            simultané pour des promos synchronisées.
                        </p>
                    </header>

                    <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
                        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4">
                                <h2 className="text-xl font-semibold text-slate-900">
                                    {events.length ? 'Choisissez votre campagne' : 'Aucune campagne ouverte'}
                                </h2>
                                {error && <p className="text-sm text-red-600">{error}</p>}
                            </div>

                            {events.length > 0 ? (
                                <>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        {events.map((event) => (
                                            <button
                                                key={event.id}
                                                type="button"
                                                onClick={() => selectEvent(event.id)}
                                                className={`rounded-xl border px-4 py-3 text-left transition ${selectedEvent?.id === event.id
                                                        ? 'border-indigo-500 bg-indigo-50'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="text-sm font-semibold text-slate-900">
                                                    {event.displayName}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {new Date(event.startsAt).toLocaleString('fr-FR')} →{' '}
                                                    {new Date(event.endsAt).toLocaleString('fr-FR')}
                                                </div>
                                                <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                                                    {event.description || 'Campagne officielle'}
                                                </p>
                                            </button>
                                        ))}
                                    </div>

                                    {selectedEvent && (
                                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    ID Service à promouvoir
                                                    <input
                                                        type="number"
                                                        value={form.serviceId}
                                                        onChange={(e) =>
                                                            setForm((prev) => ({ ...prev, serviceId: e.target.value }))
                                                        }
                                                        required
                                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                        placeholder="Ex: 2451"
                                                    />
                                                </label>
                                                <label className="text-sm font-medium text-slate-700">
                                                    Prix promo (CFA)
                                                    <input
                                                        type="number"
                                                        value={form.promoPriceCfa}
                                                        onChange={(e) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                promoPriceCfa: e.target.value,
                                                            }))
                                                        }
                                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                    />
                                                </label>
                                                <label className="text-sm font-medium text-slate-700">
                                                    Réduction (%)
                                                    <input
                                                        type="number"
                                                        value={form.discountPercentage}
                                                        onChange={(e) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                discountPercentage: e.target.value,
                                                            }))
                                                        }
                                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                    />
                                                </label>
                                                <label className="text-sm font-medium text-slate-700">
                                                    Stock promo
                                                    <input
                                                        type="number"
                                                        value={form.stockCap}
                                                        onChange={(e) =>
                                                            setForm((prev) => ({ ...prev, stockCap: e.target.value }))
                                                        }
                                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                    />
                                                </label>
                                                <label className="text-sm font-medium text-slate-700">
                                                    Disponibilité
                                                    <select
                                                        value={form.availability}
                                                        onChange={(e) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                availability: e.target.value as 'online' | 'live' | 'both',
                                                            }))
                                                        }
                                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                    >
                                                        <option value="online">Catalogue en ligne</option>
                                                        <option value="live">Live seulement</option>
                                                        <option value="both">Catalogue + Live</option>
                                                    </select>
                                                </label>
                                                <label className="text-sm font-medium text-slate-700">
                                                    Message interne
                                                    <textarea
                                                        value={form.note}
                                                        onChange={(e) =>
                                                            setForm((prev) => ({ ...prev, note: e.target.value }))
                                                        }
                                                        rows={3}
                                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                        placeholder="Ex: Live prévu samedi 18h, besoin de badge 'Cuisine'."
                                                    />
                                                </label>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={submitting || !form.serviceId}
                                                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {submitting ? 'Soumission en cours...' : 'Envoyer ma promotion'}
                                            </button>
                                        </form>
                                    )}
                                </>
                            ) : (
                                <p className="mt-4 text-sm text-slate-500">
                                    Aucune campagne globale n’est ouverte pour le moment. Revenez plus tard ou vérifiez la
                                    console admin Yukpo.
                                </p>
                            )}
                        </section>

                        <aside className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h3 className="text-base font-semibold text-slate-900">Vos demandes</h3>
                                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                                    {entries.slice(0, 6).map((entry) => (
                                        <li
                                            key={entry.id}
                                            className="rounded-lg border border-slate-100 px-3 py-2 text-xs text-slate-600"
                                        >
                                            <div className="font-semibold text-slate-900">
                                                Service #{entry.serviceId}
                                            </div>
                                            <div className="text-slate-500">Statut: {entry.status}</div>
                                        </li>
                                    ))}
                                    {!entries.length && (
                                        <li className="text-xs text-slate-500">
                                            Aucune demande envoyée pour le moment.
                                        </li>
                                    )}
                                </ul>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                                <p className="font-semibold text-slate-900">Procédure</p>
                                <ol className="mt-2 list-inside list-decimal space-y-1">
                                    <li>Choisissez un de vos services</li>
                                    <li>Indiquez votre prix promo et stock dédié</li>
                                    <li>L’équipe Yukpo valide et publie à l’heure prévue</li>
                                </ol>
                                <p className="mt-2 text-xs text-slate-500">
                                    Une fois validée, la promo s’affiche côté mobile + live, avec notifications automatiques.
                                </p>
                            </div>
                        </aside>
                    </div>
                </div>
            </AppLayout>
        </RequireAccess>
    );
};

export default GlobalPromoSelfServicePage;

