import axios from 'axios';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useFeatureFlags } from '@/context';
import { useUser } from '@/hooks/useUser';
import { ROUTES } from '@/routes/AppRoutesRegistry';
import {
    configureFlashSales,
    fetchFlashSales,
    startLiveSession,
    type FlashSaleInput,
} from '@/services/liveApi';
import type { LiveFlashSale } from '@/types/live';

const formatDateTimeLocal = (date: Date): string => {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

interface UserService {
    id: number;
    title?: string;
    nom_service?: string;
    nom?: string;
    actif?: boolean;
    is_active?: boolean;
}

interface FlashSaleDraft {
    id: string;
    serviceId: string;
    promoPrice: string;
    stockTarget: string;
    startAt: string;
    endAt: string;
    commentaryMode: 'host' | 'ai_voice';
    commentaryInterval: string;
    aiVoiceProfile: string;
}

const GoLivePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isLoading } = useUser();
    const { isEnabled } = useFeatureFlags();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [scheduledStart, setScheduledStart] = useState(() => formatDateTimeLocal(new Date(Date.now() + 15 * 60 * 1000)));
    const [primaryServiceId, setPrimaryServiceId] = useState<string>('');
    const [linkedServiceIds, setLinkedServiceIds] = useState<string[]>([]);
    const [services, setServices] = useState<UserService[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [configuredFlashSales, setConfiguredFlashSales] = useState<LiveFlashSale[]>([]);
    const [flashSalesDrafts, setFlashSalesDrafts] = useState<FlashSaleDraft[]>([]);
    const [savingFlashSales, setSavingFlashSales] = useState(false);

    useEffect(() => {
        if (isLoading) return;
        if (!user) {
            navigate(ROUTES.LOGIN, { replace: true });
            return;
        }

        const fetchServices = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const response = await axios.get('/api/prestataire/services', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                setServices(response.data ?? []);
            } catch (error) {
                console.warn('[GoLivePage] Impossible de récupérer les services', error);
            }
        };

        if (isEnabled('connectors_livekit')) {
            fetchServices();
        }
    }, [user, isLoading, navigate, isEnabled]);

    const availableServices = useMemo(() => {
        return services.filter((service) => {
            const isActive = service.is_active ?? service.actif ?? true;
            return isActive;
        });
    }, [services]);

    const additionalLinkedCount = useMemo(
        () => linkedServiceIds.filter((id) => id !== primaryServiceId).length,
        [linkedServiceIds, primaryServiceId],
    );

    useEffect(() => {
        if (primaryServiceId && !linkedServiceIds.includes(primaryServiceId)) {
            setLinkedServiceIds((prev) => [...prev, primaryServiceId]);
        }
    }, [primaryServiceId]);

    const toggleLinkedService = (id: number) => {
        const idStr = id.toString();
        if (primaryServiceId && idStr === primaryServiceId) {
            return;
        }

        setLinkedServiceIds((prev) => {
            if (prev.includes(idStr)) {
                return prev.filter((value) => value !== idStr);
            }
            return [...prev, idStr];
        });
    };

    const generateDraftId = () =>
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 9);

    const addFlashSaleDraft = () => {
        const defaultStart = result?.session?.start_at
            ? formatDateTimeLocal(new Date(result.session.start_at))
            : scheduledStart;
        const defaultEnd = formatDateTimeLocal(
            new Date(new Date(defaultStart).getTime() + 30 * 60 * 1000),
        );

        setFlashSalesDrafts((prev) => [
            ...prev,
            {
                id: generateDraftId(),
                serviceId: primaryServiceId || '',
                promoPrice: '',
                stockTarget: '',
                startAt: defaultStart,
                endAt: defaultEnd,
                commentaryMode: 'host',
                commentaryInterval: '60',
                aiVoiceProfile: '',
            },
        ]);
    };

    const updateFlashSaleDraft = (draftId: string, field: keyof FlashSaleDraft, value: string) => {
        setFlashSalesDrafts((prev) =>
            prev.map((draft) =>
                draft.id === draftId ? ({ ...draft, [field]: value } as FlashSaleDraft) : draft,
            ),
        );
    };

    const removeFlashSaleDraft = (draftId: string) => {
        setFlashSalesDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user) {
            toast.error('Vous devez être connecté pour lancer un live.');
            return;
        }

        if (!isEnabled('connectors_livekit')) {
            toast.error("La fonctionnalité live n'est pas disponible sur cet environnement.");
            return;
        }

        if (!title.trim()) {
            toast.error('Le titre du live est obligatoire.');
            return;
        }

        const hostId = parseInt(user.id, 10);
        if (Number.isNaN(hostId)) {
            toast.error('Impossible de détecter votre identifiant utilisateur.');
            return;
        }

        try {
            setSubmitting(true);
            setResult(null);

            const linkedIds = Array.from(
                new Set(
                    linkedServiceIds
                        .map((value) => parseInt(value, 10))
                        .filter((value) => !Number.isNaN(value)),
                ),
            );

            const payload = {
                title: title.trim(),
                description: description.trim() || undefined,
                host_user_id: hostId,
                service_id: primaryServiceId ? parseInt(primaryServiceId, 10) : undefined,
                linked_service_ids: linkedIds,
                scheduled_start: new Date(scheduledStart).toISOString(),
                metadata: {
                    created_from: 'frontend',
                },
            };

            const response = await startLiveSession(payload);
            setResult(response);
            toast.success('Live créé avec succès !');
        } catch (error: any) {
            console.error('[GoLivePage] Erreur création live', error);
            // Le backend Rust peut retourner { error: "...", message: "..." }
            const message =
                error?.response?.data?.error ||
                error?.response?.data?.message ||
                error?.message ||
                'Impossible de créer le live. Veuillez réessayer.';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        const sessionId: string | undefined = result?.session?.id;
        if (!sessionId) {
            setConfiguredFlashSales([]);
            setFlashSalesDrafts([]);
            return;
        }

        let cancelled = false;

        const loadFlashSales = async () => {
            try {
                const sales = await fetchFlashSales(sessionId);
                if (cancelled) return;

                setConfiguredFlashSales(sales);
                if (sales.length > 0) {
                    setFlashSalesDrafts(
                        sales.map((sale) => ({
                            id: sale.id,
                            serviceId: sale.service_id.toString(),
                            promoPrice: sale.promo_price_cfa.toString(),
                            stockTarget: sale.stock_target.toString(),
                            startAt: formatDateTimeLocal(new Date(sale.start_at)),
                            endAt: formatDateTimeLocal(new Date(sale.end_at)),
                            commentaryMode: sale.commentary_mode,
                            commentaryInterval: sale.commentary_interval_seconds.toString(),
                            aiVoiceProfile: sale.ai_voice_profile ?? '',
                        })),
                    );
                } else {
                    setFlashSalesDrafts([]);
                }
            } catch (error) {
                console.warn('[GoLivePage] Impossible de récupérer les ventes flash', error);
            }
        };

        loadFlashSales();

        return () => {
            cancelled = true;
        };
    }, [result?.session?.id]);

    const handleFlashSalesSave = async () => {
        if (!result?.session?.id) {
            toast.error('Créez d’abord un live avant de programmer des ventes flash.');
            return;
        }

        if (flashSalesDrafts.length === 0) {
            toast.error('Ajoutez au moins une vente flash à programmer.');
            return;
        }

        const items: FlashSaleInput[] = [];
        for (const draft of flashSalesDrafts) {
            if (!draft.serviceId) {
                toast.error('Sélectionnez un service pour chaque vente flash.');
                return;
            }

            const serviceId = parseInt(draft.serviceId, 10);
            if (Number.isNaN(serviceId)) {
                toast.error('Service sélectionné invalide.');
                return;
            }

            const promoPrice = parseFloat(draft.promoPrice.replace(',', '.'));
            if (!Number.isFinite(promoPrice) || promoPrice <= 0) {
                toast.error('Le prix promotionnel doit être un nombre positif.');
                return;
            }

            const stockTarget = parseInt(draft.stockTarget, 10);
            if (Number.isNaN(stockTarget) || stockTarget <= 0) {
                toast.error('Le stock promotionnel doit être supérieur à zéro.');
                return;
            }

            if (!draft.startAt || !draft.endAt) {
                toast.error('Renseignez les horaires de début et de fin pour chaque vente flash.');
                return;
            }

            const commentaryInterval = parseInt(draft.commentaryInterval, 10);
            if (Number.isNaN(commentaryInterval) || commentaryInterval < 15) {
                toast.error('L’intervalle de commentaire doit être supérieur ou égal à 15 secondes.');
                return;
            }

            const commentaryMode = draft.commentaryMode ?? 'host';

            const startDate = new Date(draft.startAt);
            const endDate = new Date(draft.endAt);

            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                toast.error('Les dates fournies ne sont pas valides.');
                return;
            }

            if (endDate <= startDate) {
                toast.error('La date de fin doit être postérieure à la date de début.');
                return;
            }

            items.push({
                service_id: serviceId,
                promo_price_cfa: promoPrice,
                stock_target: stockTarget,
                start_at: startDate.toISOString(),
                end_at: endDate.toISOString(),
                commentary_mode: commentaryMode,
                commentary_interval_seconds: commentaryInterval,
                ai_voice_profile: commentaryMode === 'ai_voice' && draft.aiVoiceProfile.trim() !== ''
                    ? draft.aiVoiceProfile.trim()
                    : undefined,
                metadata: {
                    draft_id: draft.id,
                },
            });
        }

        try {
            setSavingFlashSales(true);
            const saved = await configureFlashSales(result.session.id, items);
            setConfiguredFlashSales(saved);
            setFlashSalesDrafts(
                saved.map((sale) => ({
                    id: sale.id,
                    serviceId: sale.service_id.toString(),
                    promoPrice: sale.promo_price_cfa.toString(),
                    stockTarget: sale.stock_target.toString(),
                    startAt: formatDateTimeLocal(new Date(sale.start_at)),
                    endAt: formatDateTimeLocal(new Date(sale.end_at)),
                    commentaryMode: sale.commentary_mode,
                    commentaryInterval: sale.commentary_interval_seconds.toString(),
                    aiVoiceProfile: sale.ai_voice_profile ?? '',
                })),
            );
            toast.success('Ventes flash enregistrées avec succès.');
        } catch (error: any) {
            console.error('[GoLivePage] Erreur configuration ventes flash', error);
            const message =
                error?.response?.data?.error ||
                error?.response?.data?.message ||
                error?.message ||
                "Impossible d'enregistrer les ventes flash.";
            toast.error(message);
        } finally {
            setSavingFlashSales(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl px-4 py-12">
            <div className="mb-8">
                <button
                    onClick={() => navigate(-1)}
                    className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                    ← Retour
                </button>
            </div>

            <header>
                <h1 className="text-3xl font-bold text-gray-900">Lancer un live</h1>
                <p className="mt-2 text-gray-600">
                    Programmez un live shopping en quelques secondes et obtenez immédiatement vos URLs RTMP /
                    WebRTC.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="mt-10 space-y-8">
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Titre du live <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Ex : Live coiffure spéciale mariage"
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={3}
                        placeholder="Quelques mots sur le programme, les offres, etc."
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Service associé
                        </label>
                        <select
                            value={primaryServiceId}
                            onChange={(event) => setPrimaryServiceId(event.target.value)}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                        >
                            <option value="">— Aucun (live général) —</option>
                            {availableServices.map((service) => (
                                <option key={service.id} value={service.id}>
                                    {service.title || service.nom_service || service.nom || `Service #${service.id}`}
                                </option>
                            ))}
                        </select>
                        {services.length > 0 && availableServices.length === 0 && (
                            <p className="mt-2 text-sm text-amber-600">
                                Tous vos services sont inactifs. Réactivez-en un pour le lier au live.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Produits/services associés (facultatif)
                        </label>
                        <div className="mt-2 space-y-2 rounded-md border border-gray-200 p-3">
                            {availableServices.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    Aucun service actif disponible. Réactivez un service pour l’ajouter au live.
                                </p>
                            ) : (
                                availableServices.map((service) => (
                                    <label key={service.id} className="flex items-start gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                                            checked={linkedServiceIds.includes(service.id.toString())}
                                            onChange={() => toggleLinkedService(service.id)}
                                            disabled={primaryServiceId === service.id.toString()}
                                        />
                                        <span>
                                            <span className="font-medium text-gray-900">
                                                {service.title || service.nom_service || service.nom || `Service #${service.id}`}
                                            </span>
                                            {primaryServiceId && primaryServiceId === service.id.toString() && (
                                                <span className="ml-2 text-xs text-indigo-600">(service principal)</span>
                                            )}
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>
                        {additionalLinkedCount > 0 && (
                            <p className="mt-2 text-xs text-gray-500">
                                Les services sélectionnés seront mis en avant pendant le live (carrousel produit).
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Démarrage prévu <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="datetime-local"
                            value={scheduledStart}
                            onChange={(event) => setScheduledStart(event.target.value)}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                            required
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(ROUTES.LIVES)}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300"
                    >
                        Voir les lives
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? 'Création en cours…' : 'Créer le live'}
                    </button>
                </div>
            </form>

            {result && (
                <section className="mt-12 rounded-xl border border-indigo-100 bg-indigo-50 p-6">
                    <h2 className="text-xl font-semibold text-indigo-900">Live créé avec succès 🎉</h2>
                    <p className="mt-2 text-sm text-indigo-800">
                        Vous pouvez utiliser les informations suivantes pour lancer votre diffusion.
                    </p>

                    <dl className="mt-6 grid gap-4 text-sm text-indigo-900 md:grid-cols-2">
                        {result?.session?.livekit_ingress_url && (
                            <>
                                <div>
                                    <dt className="font-medium uppercase tracking-wide text-indigo-700">
                                        URL RTMP
                                    </dt>
                                    <dd className="mt-1 break-all">{result.session.livekit_ingress_url}</dd>
                                </div>
                                <div>
                                    <dt className="font-medium uppercase tracking-wide text-indigo-700">
                                        Clé de stream
                                    </dt>
                                    <dd className="mt-1 break-all">{result.session.stream_key || '—'}</dd>
                                </div>
                            </>
                        )}
                        {result?.session?.hls_url && (
                            <div className="md:col-span-2">
                                <dt className="font-medium uppercase tracking-wide text-indigo-700">
                                    URL HLS
                                </dt>
                                <dd className="mt-1 break-all">{result.session.hls_url}</dd>
                            </div>
                        )}
                        {result?.session?.fallback_hls_url && (
                            <div className="md:col-span-2">
                                <dt className="font-medium uppercase tracking-wide text-indigo-700">
                                    URL HLS de secours
                                </dt>
                                <dd className="mt-1 break-all">{result.session.fallback_hls_url}</dd>
                            </div>
                        )}
                    </dl>
                </section>
            )}

            {result?.session?.id && (
                <section className="mt-12 space-y-6">
                    <header className="space-y-2">
                        <h2 className="text-2xl font-semibold text-gray-900">Programmer des ventes flash</h2>
                        <p className="text-sm text-gray-600">
                            Définissez des promotions chronométrées visibles par tous les spectateurs. Chaque vente
                            flash déclenche automatiquement des notifications ciblées.
                        </p>
                    </header>

                    {flashSalesDrafts.length === 0 && (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
                            Aucune vente flash programmée pour l’instant. Ajoutez-en une pour profiter des promos chrono.
                        </div>
                    )}

                    <div className="space-y-4">
                        {flashSalesDrafts.map((draft) => (
                            <div
                                key={draft.id}
                                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="grid flex-1 gap-4 md:grid-cols-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Produit ciblé
                                            <select
                                                value={draft.serviceId}
                                                onChange={(event) =>
                                                    updateFlashSaleDraft(draft.id, 'serviceId', event.target.value)
                                                }
                                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                                            >
                                                <option value="">— Choisir un service —</option>
                                                {availableServices.map((service) => (
                                                    <option key={service.id} value={service.id}>
                                                        {service.title ||
                                                            service.nom_service ||
                                                            service.nom ||
                                                            `Service #${service.id}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="text-sm font-medium text-gray-700">
                                            Prix promo (CFA)
                                            <input
                                                type="number"
                                                min="0"
                                                step="100"
                                                value={draft.promoPrice}
                                                onChange={(event) =>
                                                    updateFlashSaleDraft(draft.id, 'promoPrice', event.target.value)
                                                }
                                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                                                placeholder="Ex : 15000"
                                            />
                                        </label>

                                        <label className="text-sm font-medium text-gray-700">
                                            Stock promo (unités)
                                            <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={draft.stockTarget}
                                                onChange={(event) =>
                                                    updateFlashSaleDraft(draft.id, 'stockTarget', event.target.value)
                                                }
                                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                                                placeholder="Ex : 25"
                                            />
                                        </label>

                                        <label className="text-sm font-medium text-gray-700">
                                            Début
                                            <input
                                                type="datetime-local"
                                                value={draft.startAt}
                                                onChange={(event) =>
                                                    updateFlashSaleDraft(draft.id, 'startAt', event.target.value)
                                                }
                                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                                            />
                                        </label>

                                        <label className="text-sm font-medium text-gray-700">
                                            Fin
                                            <input
                                                type="datetime-local"
                                                value={draft.endAt}
                                                onChange={(event) =>
                                                    updateFlashSaleDraft(draft.id, 'endAt', event.target.value)
                                                }
                                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                                            />
                                        </label>

                                        <label className="text-sm font-medium text-gray-700 md:col-span-2">
                                            Mode de commentaire
                                            <select
                                                value={draft.commentaryMode}
                                                onChange={(event) =>
                                                    updateFlashSaleDraft(
                                                        draft.id,
                                                        'commentaryMode',
                                                        event.target.value as 'host' | 'ai_voice',
                                                    )
                                                }
                                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                                            >
                                                <option value="host">Commentaire en direct par le prestataire</option>
                                                <option value="ai_voice">Commentaire automatique (voix IA)</option>
                                            </select>
                                            <span className="mt-1 block text-xs text-gray-500">
                                                {draft.commentaryMode === 'ai_voice'
                                                    ? 'Une voix IA annonce périodiquement la progression des réservations.'
                                                    : 'Le commentaire reste géré par vous ou votre équipe.'}
                                            </span>
                                        </label>

                                        <label className="text-sm font-medium text-gray-700">
                                            Intervalle IA (secondes)
                                            <input
                                                type="number"
                                                min="15"
                                                step="5"
                                                value={draft.commentaryInterval}
                                                onChange={(event) =>
                                                    updateFlashSaleDraft(
                                                        draft.id,
                                                        'commentaryInterval',
                                                        event.target.value,
                                                    )
                                                }
                                                disabled={draft.commentaryMode !== 'ai_voice'}
                                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:bg-gray-100"
                                                placeholder="60"
                                            />
                                            <span className="mt-1 block text-xs text-gray-500">
                                                Fréquence des annonces IA. Minimum 15 secondes.
                                            </span>
                                        </label>

                                        <label className="text-sm font-medium text-gray-700">
                                            Profil vocal IA (optionnel)
                                            <input
                                                type="text"
                                                value={draft.aiVoiceProfile}
                                                onChange={(event) =>
                                                    updateFlashSaleDraft(draft.id, 'aiVoiceProfile', event.target.value)
                                                }
                                                disabled={draft.commentaryMode !== 'ai_voice'}
                                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:bg-gray-100"
                                                placeholder="voix_femme_warm, voix_homme_dynamique..."
                                            />
                                            <span className="mt-1 block text-xs text-gray-500">
                                                Laissez vide pour utiliser la voix IA par défaut.
                                            </span>
                                        </label>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => removeFlashSaleDraft(draft.id)}
                                        className="inline-flex items-center justify-center self-end rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={addFlashSaleDraft}
                            className="inline-flex items-center justify-center rounded-md border border-dashed border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                            Ajouter une vente flash
                        </button>
                        <button
                            type="button"
                            onClick={handleFlashSalesSave}
                            disabled={flashSalesDrafts.length === 0 || savingFlashSales}
                            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {savingFlashSales ? 'Enregistrement…' : 'Enregistrer les ventes flash'}
                        </button>
                    </div>

                    {configuredFlashSales.length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900">Ventes flash planifiées</h3>
                            <ul className="mt-4 space-y-3">
                                {configuredFlashSales.map((sale) => {
                                    const linked = sale.linked_service;
                                    return (
                                        <li
                                            key={sale.id}
                                            className="flex flex-col gap-2 rounded-md border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 md:flex-row md:items-center md:justify-between"
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {linked?.title || `Produit #${sale.service_id}`}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(sale.start_at).toLocaleString('fr-FR')} →{' '}
                                                    {new Date(sale.end_at).toLocaleString('fr-FR')}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                                                <span>
                                                    Promo:{' '}
                                                    <span className="font-semibold text-indigo-600">
                                                        {sale.promo_price_cfa.toLocaleString('fr-FR', {
                                                            minimumFractionDigits: 0,
                                                        })}{' '}
                                                        CFA
                                                    </span>
                                                </span>
                                                <span>
                                                    Stock réservé:{' '}
                                                    <span className="font-semibold">
                                                        {sale.reserved_quantity}/{sale.stock_target}
                                                    </span>
                                                </span>
                                                <span>
                                                    Commentaire:{' '}
                                                    <span className="font-semibold">
                                                        {sale.commentary_mode === 'ai_voice'
                                                            ? `Voix IA (toutes les ${sale.commentary_interval_seconds}s)`
                                                            : 'Prestataire'}
                                                    </span>
                                                </span>
                                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                                                    Statut: {sale.status}
                                                </span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default GoLivePage;

