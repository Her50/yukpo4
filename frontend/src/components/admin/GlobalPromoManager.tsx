import React, { useMemo, useState } from 'react';

import useGlobalPromos from '@/hooks/useGlobalPromos';
import type { GlobalPromoEntry } from '@/types/globalPromo';

const formatDateTimeLocal = (value: Date) => value.toISOString().slice(0, 16);

const availabilityOptions = [
    { value: 'online', label: 'Catalogue en ligne' },
    { value: 'live', label: 'Ventes Live uniquement' },
    { value: 'both', label: 'Catalogue + Live' },
];

const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

const GlobalPromoManager: React.FC = () => {
    const {
        events,
        entries,
        selectedEvent,
        loadingEvents,
        loadingEntries,
        error,
        selectEvent,
        createEvent,
        upsertEntry,
        reviewEntry,
        reviewEntriesBulk,
    } = useGlobalPromos();

    const [eventForm, setEventForm] = useState({
        displayName: 'Black Friday national',
        theme: 'black_friday',
        slug: '',
        description: '',
        startsAt: formatDateTimeLocal(new Date()),
        endsAt: formatDateTimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000)),
        recurrenceRule: '',
        highlightColor: '#6366F1',
        bannerText: 'Promotions exceptionnelles visibles par tous',
    });

    const [entryForm, setEntryForm] = useState({
        serviceId: '',
        discountPercentage: '',
        promoPriceCfa: '',
        stockCap: '',
        availability: 'online',
        metadata: '',
        highlighted: true,
        priorityScore: 10,
    });

    const [submittingEvent, setSubmittingEvent] = useState(false);
    const [submittingEntry, setSubmittingEntry] = useState(false);
    const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<GlobalPromoEntry | null>(
        null,
    );

    const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<GlobalPromoEntry | null>(
        null,
    );
    const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');

    const stats = useMemo(() => {
        const liveCount = events.filter((event) => event.status === 'live').length;
        const scheduledCount = events.filter((event) => event.status === 'scheduled').length;
        return { liveCount, scheduledCount };
    }, [events]);

    const filteredEntries = useMemo(() => {
        if (statusFilter === 'all') return entries;
        return entries.filter((entry) => entry.status === statusFilter);
    }, [entries, statusFilter]);

    const handleEventSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmittingEvent(true);
        try {
            const slug = eventForm.slug.trim() || slugify(eventForm.displayName);
            await createEvent({
                slug,
                theme: eventForm.theme,
                displayName: eventForm.displayName,
                description: eventForm.description || undefined,
                startsAt: new Date(eventForm.startsAt).toISOString(),
                endsAt: new Date(eventForm.endsAt).toISOString(),
                recurrenceRule: eventForm.recurrenceRule || undefined,
                config: {
                    highlightColor: eventForm.highlightColor,
                    bannerText: eventForm.bannerText,
                },
            });
            setEventForm((prev) => ({
                ...prev,
                slug: '',
                description: '',
                recurrenceRule: '',
            }));
        } finally {
            setSubmittingEvent(false);
        }
    };

    const handleEntrySubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedEvent) return;
        setSubmittingEntry(true);
        try {
            const metadataSafe =
                entryForm.metadata.trim().length > 0
                    ? JSON.parse(entryForm.metadata)
                    : {
                        badge: 'Black Friday',
                        highlight: true,
                    };

            await upsertEntry({
                serviceId: Number(entryForm.serviceId),
                discountPercentage: entryForm.discountPercentage
                    ? Number(entryForm.discountPercentage)
                    : undefined,
                promoPriceCfa: entryForm.promoPriceCfa ? Number(entryForm.promoPriceCfa) : undefined,
                stockCap: entryForm.stockCap ? Number(entryForm.stockCap) : undefined,
                availability: entryForm.availability as GlobalPromoEntry['availability'],
                metadata: metadataSafe,
                highlighted: entryForm.highlighted,
                priorityScore: entryForm.priorityScore,
            });

            setEntryForm((prev) => ({
                ...prev,
                serviceId: '',
                discountPercentage: '',
                promoPriceCfa: '',
                stockCap: '',
            }));
        } catch (err) {
            console.error('[GlobalPromoManager] Impossible de créer la promo', err);
            alert('Impossible de créer cette entrée. Vérifiez les identifiants service & format JSON.');
        } finally {
            setSubmittingEntry(false);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    <span>🎯</span>
                    <span>Campagnes globales (Black Friday, ventes flash publiques)</span>
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-slate-600">
                    <div>
                        <span className="text-2xl font-bold text-slate-900">{events.length}</span>{' '}
                        campagnes connues
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-emerald-600">{stats.liveCount}</span>{' '}
                        actives
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-indigo-600">{stats.scheduledCount}</span>{' '}
                        programmées
                    </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="grid gap-6 border-b border-slate-100 p-6 md:grid-cols-2">
                <form onSubmit={handleEventSubmit} className="space-y-3 rounded-xl border border-slate-100 p-4">
                    <h3 className="text-lg font-semibold text-slate-900">Créer / planifier un évènement</h3>
                    <div className="grid gap-3">
                        <label className="text-sm font-medium text-slate-700">
                            Nom public
                            <input
                                type="text"
                                value={eventForm.displayName}
                                onChange={(e) =>
                                    setEventForm((prev) => ({ ...prev, displayName: e.target.value }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                required
                            />
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                            Slug (optionnel)
                            <input
                                type="text"
                                value={eventForm.slug}
                                onChange={(e) => setEventForm((prev) => ({ ...prev, slug: e.target.value }))}
                                placeholder="black-friday-2025"
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                            Thème
                            <input
                                type="text"
                                value={eventForm.theme}
                                onChange={(e) => setEventForm((prev) => ({ ...prev, theme: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                required
                            />
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                            Description
                            <textarea
                                value={eventForm.description}
                                onChange={(e) =>
                                    setEventForm((prev) => ({ ...prev, description: e.target.value }))
                                }
                                rows={2}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="text-sm font-medium text-slate-700">
                                Début
                                <input
                                    type="datetime-local"
                                    value={eventForm.startsAt}
                                    onChange={(e) =>
                                        setEventForm((prev) => ({ ...prev, startsAt: e.target.value }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                    required
                                />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                                Fin
                                <input
                                    type="datetime-local"
                                    value={eventForm.endsAt}
                                    onChange={(e) =>
                                        setEventForm((prev) => ({ ...prev, endsAt: e.target.value }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                    required
                                />
                            </label>
                        </div>
                        <label className="text-sm font-medium text-slate-700">
                            Récurrence (RRULE optionnelle)
                            <input
                                type="text"
                                value={eventForm.recurrenceRule}
                                onChange={(e) =>
                                    setEventForm((prev) => ({ ...prev, recurrenceRule: e.target.value }))
                                }
                                placeholder="FREQ=YEARLY;BYDAY=FR;BYSETPOS=4"
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="text-sm font-medium text-slate-700">
                                Couleur highlight
                                <input
                                    type="color"
                                    value={eventForm.highlightColor}
                                    onChange={(e) =>
                                        setEventForm((prev) => ({ ...prev, highlightColor: e.target.value }))
                                    }
                                    className="mt-1 h-10 w-full cursor-pointer rounded-md border border-slate-200"
                                />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                                Message bannière
                                <input
                                    type="text"
                                    value={eventForm.bannerText}
                                    onChange={(e) =>
                                        setEventForm((prev) => ({ ...prev, bannerText: e.target.value }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                            </label>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submittingEvent}
                        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submittingEvent ? 'Planification...' : 'Ajouter / mettre à jour'}
                    </button>
                </form>

                <div className="space-y-4 rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Campagnes existantes</h3>
                        {loadingEvents && (
                            <span className="text-xs font-medium text-slate-500">Chargement...</span>
                        )}
                    </div>
                    <div className="flex flex-col gap-3">
                        {events.map((event) => (
                            <button
                                key={event.id}
                                type="button"
                                onClick={() => selectEvent(event.id)}
                                className={`rounded-xl border px-4 py-3 text-left transition hover:border-indigo-300 ${event.id === selectedEvent?.id
                                    ? 'border-indigo-500 bg-indigo-50/50'
                                    : 'border-slate-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between text-sm text-slate-500">
                                    <span className="font-semibold text-slate-900">{event.displayName}</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                        {event.status}
                                    </span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                    {new Date(event.startsAt).toLocaleString('fr-FR')} →{' '}
                                    {new Date(event.endsAt).toLocaleString('fr-FR')}
                                </div>
                                {event.description && (
                                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">{event.description}</p>
                                )}
                            </button>
                        ))}
                        {!events.length && !loadingEvents && (
                            <p className="text-sm text-slate-500">
                                Aucune campagne enregistrée. Créez votre premier Black Friday pour synchroniser tous
                                les prestataires.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {selectedEvent && (
                <div className="space-y-6 p-6">
                    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm text-slate-500">Campagne sélectionnée</div>
                        <div className="text-xl font-semibold text-slate-900">{selectedEvent.displayName}</div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                            <div>
                                {entries.length} produit(s) participant(s) – statut{' '}
                                <span className="font-semibold">{selectedEvent.status}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500">Filtrer par statut :</span>
                                <select
                                    value={statusFilter}
                                    onChange={(e) =>
                                        setStatusFilter(
                                            e.target.value as 'all' | 'pending_review' | 'approved' | 'rejected',
                                        )
                                    }
                                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                                >
                                    <option value="all">Tous</option>
                                    <option value="pending_review">En revue</option>
                                    <option value="approved">Approuvé</option>
                                    <option value="rejected">Refusé</option>
                                </select>
                                {selectedEntryIds.length > 0 && (
                                    <>
                                        <span className="h-4 w-px bg-slate-200" />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await reviewEntriesBulk(selectedEntryIds, {
                                                        status: 'approved',
                                                    });
                                                    setSelectedEntryIds([]);
                                                } catch (err) {
                                                    console.error(
                                                        '[GlobalPromoManager] Bulk approve failed',
                                                        err,
                                                    );
                                                    alert(
                                                        "Impossible d'approuver les entrées sélectionnées.",
                                                    );
                                                }
                                            }}
                                            className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-500"
                                        >
                                            Approuver la sélection
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-4 py-2">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={
                                                filteredEntries.length > 0 &&
                                                selectedEntryIds.length === filteredEntries.length
                                            }
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedEntryIds(filteredEntries.map((e) => e.id));
                                                } else {
                                                    setSelectedEntryIds([]);
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="px-4 py-2">Service</th>
                                    <th className="px-4 py-2">Prix promo</th>
                                    <th className="px-4 py-2">Réduction</th>
                                    <th className="px-4 py-2">Stock cible</th>
                                    <th className="px-4 py-2">Disponibilité</th>
                                    <th className="px-4 py-2">Statut</th>
                                    <th className="px-4 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredEntries.map((entry) => (
                                    <tr key={entry.id}>
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={selectedEntryIds.includes(entry.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedEntryIds((prev) => [...prev, entry.id]);
                                                    } else {
                                                        setSelectedEntryIds((prev) =>
                                                            prev.filter((id) => id !== entry.id),
                                                        );
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td className="px-4 py-2 font-mono text-slate-700">{entry.serviceId}</td>
                                        <td className="px-4 py-2 text-slate-700">
                                            {entry.promoPriceCfa
                                                ? `${entry.promoPriceCfa.toLocaleString('fr-FR')} CFA`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-2 text-slate-700">
                                            {entry.discountPercentage ? `${entry.discountPercentage}%` : '—'}
                                        </td>
                                        <td className="px-4 py-2 text-slate-700">
                                            {entry.stockCap ? entry.stockCap : '—'}
                                        </td>
                                        <td className="px-4 py-2 capitalize text-slate-700">{entry.availability}</td>
                                        <td className="px-4 py-2">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${entry.status === 'pending_review'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : entry.status === 'approved'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : entry.status === 'rejected'
                                                                ? 'bg-red-100 text-red-800'
                                                                : 'bg-slate-100 text-slate-700'
                                                    }`}
                                            >
                                                {entry.status === 'pending_review'
                                                    ? 'En revue'
                                                    : entry.status === 'approved'
                                                        ? 'Approuvé'
                                                        : entry.status === 'rejected'
                                                            ? 'Refusé'
                                                            : entry.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedEntryForDetails(entry)}
                                                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                                >
                                                    Détails
                                                </button>
                                                {entry.status === 'pending_review' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    await reviewEntry(entry.id, {
                                                                        status: 'approved',
                                                                    });
                                                                } catch (err) {
                                                                    console.error('[GlobalPromoManager] Approve failed', err);
                                                                    alert("Impossible d'approuver cette entrée.");
                                                                }
                                                            }}
                                                            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                                                        >
                                                            Approuver
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const message = window.prompt(
                                                                    "Motif du refus (visible côté prestataire) :",
                                                                );
                                                                try {
                                                                    await reviewEntry(entry.id, {
                                                                        status: 'rejected',
                                                                        message: message || undefined,
                                                                    });
                                                                } catch (err) {
                                                                    console.error('[GlobalPromoManager] Reject failed', err);
                                                                    alert("Impossible de refuser cette entrée.");
                                                                }
                                                            }}
                                                            className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-500"
                                                        >
                                                            Refuser
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!entries.length && (
                                    <tr>
                                        <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                                            {loadingEntries
                                                ? 'Chargement des produits...'
                                                : 'Aucun produit n’est rattaché à cette campagne.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <form
                        onSubmit={handleEntrySubmit}
                        className="space-y-3 rounded-2xl border border-slate-100 p-4"
                    >
                        <h3 className="text-lg font-semibold text-slate-900">
                            Ajouter les produits des prestataires à cette campagne
                        </h3>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="text-sm font-medium text-slate-700">
                                ID Service
                                <input
                                    type="number"
                                    value={entryForm.serviceId}
                                    onChange={(e) =>
                                        setEntryForm((prev) => ({ ...prev, serviceId: e.target.value }))
                                    }
                                    required
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                                Prix promo (CFA)
                                <input
                                    type="number"
                                    value={entryForm.promoPriceCfa}
                                    onChange={(e) =>
                                        setEntryForm((prev) => ({ ...prev, promoPriceCfa: e.target.value }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                                Réduction (%)
                                <input
                                    type="number"
                                    value={entryForm.discountPercentage}
                                    onChange={(e) =>
                                        setEntryForm((prev) => ({ ...prev, discountPercentage: e.target.value }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                                Stock promo
                                <input
                                    type="number"
                                    value={entryForm.stockCap}
                                    onChange={(e) =>
                                        setEntryForm((prev) => ({ ...prev, stockCap: e.target.value }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                                Disponibilité
                                <select
                                    value={entryForm.availability}
                                    onChange={(e) =>
                                        setEntryForm((prev) => ({ ...prev, availability: e.target.value }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                >
                                    {availabilityOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                                Score de priorité (tri catalogue)
                                <input
                                    type="number"
                                    value={entryForm.priorityScore}
                                    onChange={(e) =>
                                        setEntryForm((prev) => ({
                                            ...prev,
                                            priorityScore: Number(e.target.value),
                                        }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                            </label>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                                type="checkbox"
                                checked={entryForm.highlighted}
                                onChange={(e) =>
                                    setEntryForm((prev) => ({ ...prev, highlighted: e.target.checked }))
                                }
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Mettre en avant dans le carrousel public
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                            Métadonnées (JSON)
                            <textarea
                                value={entryForm.metadata}
                                onChange={(e) =>
                                    setEntryForm((prev) => ({ ...prev, metadata: e.target.value }))
                                }
                                rows={3}
                                placeholder='{"tagline":"Promo nationale"}'
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={submittingEntry}
                            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submittingEntry ? 'Ajout en cours...' : 'Ajouter / mettre à jour ce produit'}
                        </button>
                    </form>

                    {selectedEntryForDetails && (
                        <div className="mt-4 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-slate-900">
                                        Détails de l’entrée #{selectedEntryForDetails.serviceId}
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedEntryForDetails(null)}
                                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                                    >
                                        Fermer
                                    </button>
                                </div>
                                <div className="grid gap-1 text-xs text-slate-600">
                                    <div>
                                        <span className="font-semibold">Statut:</span>{' '}
                                        <span>{selectedEntryForDetails.status}</span>
                                    </div>
                                    <div>
                                        <span className="font-semibold">Disponibilité:</span>{' '}
                                        <span>{selectedEntryForDetails.availability}</span>
                                    </div>
                                    <div>
                                        <span className="font-semibold">Prix promo:</span>{' '}
                                        <span>
                                            {selectedEntryForDetails.promoPriceCfa
                                                ? `${selectedEntryForDetails.promoPriceCfa.toLocaleString(
                                                    'fr-FR',
                                                )} CFA`
                                                : '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-semibold">Réduction:</span>{' '}
                                        <span>
                                            {selectedEntryForDetails.discountPercentage
                                                ? `${selectedEntryForDetails.discountPercentage}%`
                                                : '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-semibold">Stock cible:</span>{' '}
                                        <span>
                                            {selectedEntryForDetails.stockCap
                                                ? selectedEntryForDetails.stockCap
                                                : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Métadonnées JSON soumises
                                    </span>
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                        readonly
                                    </span>
                                </div>
                                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-50">
                                    {JSON.stringify(selectedEntryForDetails.metadata ?? {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalPromoManager;

