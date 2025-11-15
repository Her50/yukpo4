import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import AppLayout from '@/components/layout/AppLayout';
import { fetchGlobalPromoCatalog } from '@/services/globalPromoApi';
import type { GlobalPromoCatalogItem } from '@/types/globalPromo';

const getSnapshotImage = (snapshot: any): string | undefined => {
    if (!snapshot) return undefined;
    const images = snapshot.images;
    if (Array.isArray(images) && images.length > 0) {
        if (typeof images[0] === 'string') {
            return images[0];
        }
        if (typeof images[0]?.url === 'string') {
            return images[0].url;
        }
    }
    if (typeof snapshot.cover === 'string') {
        return snapshot.cover;
    }
    return undefined;
};

const formatPrice = (value?: number | null) =>
    value ? `${value.toLocaleString('fr-FR')} CFA` : 'Prix communiquée lors du live';

const GlobalPromoCatalogPage: React.FC = () => {
    const [items, setItems] = useState<GlobalPromoCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [keyword, setKeyword] = useState('');
    const [availability, setAvailability] = useState<'all' | 'online' | 'live' | 'both'>('all');
    const [minDiscount, setMinDiscount] = useState('0');

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const data = await fetchGlobalPromoCatalog();
                setItems(data);
            } catch (err) {
                console.error('[GlobalPromoCatalog] Failed to load catalog', err);
                setError("Impossible de récupérer les promotions globales. Réessayez plus tard.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const snapshot = item.product?.snapshot ?? {};
            const title =
                snapshot.title || snapshot.nom_service || item.entry.metadata?.title || `Service #${item.entry.serviceId}`;
            const matchesKeyword =
                title.toLowerCase().includes(keyword.toLowerCase()) ||
                (snapshot.description || '').toLowerCase().includes(keyword.toLowerCase());

            const matchesAvailability =
                availability === 'all' || item.entry.availability === availability || item.entry.availability === 'both';

            const min = Number(minDiscount) || 0;
            const discount = item.entry.discountPercentage ?? 0;
            const matchesDiscount = discount >= min;

            return matchesKeyword && matchesAvailability && matchesDiscount;
        });
    }, [items, keyword, availability, minDiscount]);

    return (
        <AppLayout>
            <div className="mx-auto max-w-6xl px-4 py-12 space-y-10">
                <header className="rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-500 to-rose-500 p-8 text-white shadow-xl">
                    <p className="text-sm uppercase tracking-wide text-indigo-100">ÉDITION SPÉCIALE</p>
                    <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Black Friday fédéré Yukpo</h1>
                    <p className="mt-2 text-sm sm:text-base text-indigo-100 max-w-3xl">
                        Toutes les promotions validées par Yukpo sont regroupées ici : produits live, services en ligne et offres à
                        durée limitée. Filtrez par type, recherche textuelle ou seuil de réduction.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                            to="/promo/global"
                            className="inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/30"
                        >
                            🚀 Proposer mon service à la campagne
                        </Link>
                    </div>
                </header>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">Filtrer les promotions</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        <label className="text-sm font-medium text-slate-700">
                            Recherche
                            <input
                                type="text"
                                placeholder="Ex: coiffure, TV 4K..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                            Disponibilité
                            <select
                                value={availability}
                                onChange={(e) => setAvailability(e.target.value as typeof availability)}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="all">Tous formats</option>
                                <option value="online">Catalogue en ligne</option>
                                <option value="live">Live seulement</option>
                                <option value="both">Catalogue + Live</option>
                            </select>
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                            Réduction minimale (%)
                            <input
                                type="number"
                                min={0}
                                max={90}
                                value={minDiscount}
                                onChange={(e) => setMinDiscount(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </label>
                    </div>
                </section>

                <section>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">
                            <span className="text-sm">Chargement des offres officielles…</span>
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">{error}</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                            Aucun résultat pour ces filtres. Essayez un autre mot-clé ou réduisez le seuil de réduction.
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2">
                            {filteredItems.map((item) => {
                                const snapshot = item.product?.snapshot ?? {};
                                const image = getSnapshotImage(snapshot);
                                const title =
                                    snapshot.title || snapshot.nom_service || item.entry.metadata?.title || `Service #${item.entry.serviceId}`;
                                const description =
                                    snapshot.description ||
                                    snapshot.short_description ||
                                    item.entry.metadata?.description ||
                                    'Offre spéciale Black Friday validée par Yukpo.';

                                return (
                                    <article
                                        key={item.entry.id}
                                        className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                                    >
                                        {image && (
                                            <img src={image} alt={title} className="h-48 w-full object-cover transition group-hover:scale-105" />
                                        )}
                                        <div className="space-y-3 p-5">
                                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                                                <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">
                                                    {item.event.displayName}
                                                </span>
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{item.entry.availability}</span>
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                                            <p className="text-sm text-slate-600 line-clamp-3">{description}</p>
                                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                                <span className="font-semibold text-emerald-600">{formatPrice(item.entry.promoPriceCfa)}</span>
                                                {item.entry.discountPercentage && (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                                        -{item.entry.discountPercentage}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-slate-500">
                                                <div>
                                                    Live {new Date(item.event.startsAt).toLocaleDateString('fr-FR')} →{' '}
                                                    {new Date(item.event.endsAt).toLocaleDateString('fr-FR')}
                                                </div>
                                                {item.product?.highlighted && <span>✨ Coup de cœur Yukpo</span>}
                                            </div>
                                            <div className="pt-3">
                                                <Link
                                                    to={`/services/${item.entry.serviceId}`}
                                                    className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                                >
                                                    Voir le service détaillé →
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </AppLayout>
    );
};

export default GlobalPromoCatalogPage;

