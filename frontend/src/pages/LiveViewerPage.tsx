import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useUser } from '@/hooks/useUser';
import { ROUTES, getServiceDetailRoute } from '@/routes/AppRoutesRegistry';
import {
    fetchFlashSaleCommentaries,
    fetchJoinInformation,
    fetchLiveSession,
    getFlashSaleTicketStatus,
    reserveFlashSaleSlot,
    type FlashSaleReservationTicket,
} from '@/services/liveApi';
import type {
    LiveFlashSale,
    LiveFlashSaleCommentary,
    LiveLinkedService,
    LiveSessionResponse,
} from '@/types/live';

type JoinInformation = Awaited<ReturnType<typeof fetchJoinInformation>>;

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/600x400?text=Produit';

const formatRelativeTime = (ms: number): string => {
    if (ms <= 0) {
        return '0s';
    }
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${seconds}s`;
};

const LiveViewerPage: React.FC = () => {
    const { sessionId = '' } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const { user } = useUser();

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [details, setDetails] = useState<LiveSessionResponse | null>(null);
    const [joinInfo, setJoinInfo] = useState<JoinInformation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [reservingSaleId, setReservingSaleId] = useState<string | null>(null);
    const [activeTickets, setActiveTickets] = useState<Record<string, FlashSaleReservationTicket>>({});
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [flashSaleCommentaries, setFlashSaleCommentaries] = useState<
        Record<string, LiveFlashSaleCommentary[]>
    >({});

    useEffect(() => {
        if (!sessionId) {
            setError('Identifiant de live invalide.');
            setLoading(false);
            return;
        }

        let active = true;

        const load = async () => {
            try {
                setLoading(true);
                const response = await fetchLiveSession(sessionId);
                if (!active) return;

                setDetails(response);

                const viewerId = user ? parseInt(user.id, 10) : undefined;
                const info = await fetchJoinInformation(sessionId, Number.isNaN(viewerId || NaN) ? undefined : viewerId);
                if (!active) return;

                setJoinInfo(info);
            } catch (err) {
                console.error('[LiveViewer] Impossible de charger le live', err);
                if (active) {
                    setError(
                        "Impossible de charger les informations du live. Vérifiez que la session existe toujours.",
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [sessionId, user]);

    useEffect(() => {
        const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (flashSaleIds.length === 0) {
            setFlashSaleCommentaries({});
            return;
        }

        let cancelled = false;

        const loadCommentaries = async () => {
            try {
                const results = await Promise.all(
                    flashSaleIds.map(async (saleId) => {
                        const items = await fetchFlashSaleCommentaries(saleId, 25);
                        const sorted = [...items].sort(
                            (a, b) =>
                                new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                        );
                        return [saleId, sorted] as const;
                    }),
                );

                if (cancelled) return;

                setFlashSaleCommentaries((prev) => {
                    const next = { ...prev };
                    for (const [saleId, items] of results) {
                        next[saleId] = items;
                    }
                    return next;
                });
            } catch (err) {
                if (!cancelled) {
                    console.warn('[LiveViewer] Impossible de récupérer les commentaires IA', err);
                }
            }
        };

        loadCommentaries();
        const interval = window.setInterval(loadCommentaries, 15000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [flashSaleIdsKey, flashSaleIds]);

    useEffect(() => {
        if (!joinInfo?.hls_url || !videoRef.current) return;

        const videoEl = videoRef.current;
        const source = joinInfo.hls_url;
        let hls: any;

        if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
            videoEl.src = source;
        } else {
            (async () => {
                const module = await import('hls.js');
                const Hls = module.default;
                if (Hls.isSupported()) {
                    hls = new Hls();
                    hls.loadSource(source);
                    hls.attachMedia(videoEl);
                } else {
                    console.warn('[LiveViewer] HLS non supporté');
                }
            })();
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
        };
    }, [joinInfo?.hls_url]);

    useEffect(() => {
        if (!joinInfo?.webrtc_url || !joinInfo?.webrtc_token) return;

        let room: any;
        let cancelled = false;

        (async () => {
            try {
                setConnectionStatus('connecting');
                const livekit = await import('livekit-client');
                const { Room, RoomEvent, Track } = livekit;

                room = new Room({
                    adaptiveStream: true,
                    dynacast: true,
                });

                room.on(RoomEvent.TrackSubscribed, (track: any) => {
                    if (track.kind === Track.Kind.Video && videoRef.current) {
                        track.attach(videoRef.current);
                    }
                    if (track.kind === Track.Kind.Audio && audioRef.current) {
                        track.attach(audioRef.current);
                    }
                });

                room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
                    track.detach();
                });

                room.on(RoomEvent.Disconnected, () => {
                    setConnectionStatus('idle');
                });

                await room.connect(joinInfo.webrtc_url, joinInfo.webrtc_token);

                if (!cancelled) {
                    setConnectionStatus('connected');
                } else {
                    await room.disconnect();
                }
            } catch (err) {
                console.error('[LiveViewer] erreur connexion LiveKit', err);
                if (!cancelled) {
                    setConnectionStatus('error');
                    toast.error("Impossible d'établir la connexion WebRTC. Passage en mode replay HLS.");
                }
            }
        })();

        return () => {
            cancelled = true;
            if (room) {
                room.disconnect();
            }
        };
    }, [joinInfo?.webrtc_url, joinInfo?.webrtc_token]);

    const liveTitle = useMemo(() => details?.session.title ?? 'Live Yukpo', [details]);

    const linkedServices: LiveLinkedService[] = useMemo(() => {
        if (joinInfo?.linked_services?.length) {
            return joinInfo.linked_services;
        }
        if (details?.linked_services?.length) {
            return details.linked_services;
        }
        return [];
    }, [joinInfo, details]);

    const flashSales: LiveFlashSale[] = useMemo(() => {
        if (joinInfo?.flash_sales?.length) {
            return joinInfo.flash_sales;
        }
        if (details?.flash_sales?.length) {
            return details.flash_sales;
        }
        return [];
    }, [joinInfo, details]);

    const flashSaleIds = useMemo(() => flashSales.map((sale) => sale.id), [flashSales]);
    const flashSaleIdsKey = flashSaleIds.join('|');

    useEffect(() => {
        if (flashSales.length === 0) {
            return;
        }

        setFlashSaleCommentaries((prev) => {
            const next = { ...prev };
            let changed = false;

            flashSales.forEach((sale) => {
                if (sale.recent_commentaries && !next[sale.id]) {
                    next[sale.id] = [...sale.recent_commentaries].sort(
                        (a, b) =>
                            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                    );
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [flashSaleIdsKey, flashSales]);

    const replaceSale = (collection: LiveFlashSale[] | undefined | null, updated: LiveFlashSale): LiveFlashSale[] => {
        if (!collection || collection.length === 0) {
            return [updated];
        }
        const index = collection.findIndex((sale) => sale.id === updated.id);
        if (index === -1) {
            return [...collection, updated];
        }
        const clone = [...collection];
        clone[index] = updated;
        return clone;
    };

    const handleReserveFlashSale = async (sale: LiveFlashSale) => {
        if (!user) {
            toast.error('Connectez-vous pour réserver cette promotion.');
            navigate(ROUTES.LOGIN);
            return;
        }

        setReservingSaleId(sale.id);
        try {
            const ticket = await reserveFlashSaleSlot(sale.id);
            setActiveTickets((prev) => ({
                ...prev,
                [sale.id]: ticket,
            }));

            if (ticket.status === 'pending') {
                toast.success('Réservation en cours de traitement...');
                // Polling pour vérifier le statut
                const pollInterval = setInterval(async () => {
                    try {
                        const updatedTicket = await getFlashSaleTicketStatus(ticket.ticket_id);
                        setActiveTickets((prev) => ({
                            ...prev,
                            [sale.id]: updatedTicket,
                        }));

                        if (updatedTicket.status !== 'pending') {
                            clearInterval(pollInterval);
                            if (updatedTicket.status === 'confirmed') {
                                toast.success('Réservation confirmée !');
                                // Recharger les détails du live pour mettre à jour le stock
                                const response = await fetchLiveSession(sessionId);
                                setDetails(response);
                                const viewerId = user ? parseInt(user.id, 10) : undefined;
                                const info = await fetchJoinInformation(
                                    sessionId,
                                    Number.isNaN(viewerId || NaN) ? undefined : viewerId,
                                );
                                setJoinInfo(info);
                            } else if (updatedTicket.status === 'failed' || updatedTicket.status === 'out_of_stock') {
                                toast.error(updatedTicket.message || 'Réservation échouée');
                            }
                        }
                    } catch (err) {
                        console.error('[LiveViewer] Erreur vérification ticket', err);
                        clearInterval(pollInterval);
                    }
                }, 2000); // Vérifier toutes les 2 secondes

                // Arrêter le polling après 30 secondes
                setTimeout(() => clearInterval(pollInterval), 30000);
            } else if (ticket.status === 'confirmed') {
                toast.success('Réservation confirmée !');
                // Recharger les détails
                const response = await fetchLiveSession(sessionId);
                setDetails(response);
                const viewerId = user ? parseInt(user.id, 10) : undefined;
                const info = await fetchJoinInformation(
                    sessionId,
                    Number.isNaN(viewerId || NaN) ? undefined : viewerId,
                );
                setJoinInfo(info);
            } else {
                toast.error(ticket.message || 'Réservation échouée');
            }
        } catch (error: any) {
            console.error('[LiveViewer] Réservation flash sale impossible', error);
            const message =
                error?.response?.data?.error ||
                error?.response?.data?.message ||
                error?.message ||
                "Impossible de réserver cette vente flash.";
            toast.error(message);
        } finally {
            setReservingSaleId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="text-gray-600">Chargement du live en cours…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto max-w-xl px-4 py-16 text-center">
                <h1 className="text-2xl font-semibold text-gray-900">Oups…</h1>
                <p className="mt-3 text-gray-600">{error}</p>
                <button
                    onClick={() => navigate(ROUTES.LIVES)}
                    className="mt-6 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                    Retourner à la liste des lives
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-10">
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{liveTitle}</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        {details?.session.description ?? 'Découvrez le live Yukpo en direct ou visionnez le flux HLS.'}
                    </p>
                </div>
                <button
                    onClick={() => navigate(ROUTES.LIVES)}
                    className="inline-flex items-center justify-center rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                    ← Retour aux lives
                </button>
            </header>

            <section className="mt-8 grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black shadow-lg">
                        <video
                            ref={videoRef}
                            className="aspect-video w-full bg-black"
                            autoPlay
                            playsInline
                            controls
                            muted={connectionStatus !== 'connected'}
                        />
                        <audio ref={audioRef} autoPlay className="hidden" />
                        {connectionStatus === 'connecting' && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                                Connexion à LiveKit…
                            </div>
                        )}
                        {connectionStatus === 'error' && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                                Flux WebRTC indisponible. Repli sur le flux HLS.
                            </div>
                        )}
                    </div>
                </div>

                <aside className="space-y-4">
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900">Informations</h2>
                        <dl className="mt-3 text-sm text-gray-700 space-y-2">
                            <div>
                                <dt className="font-medium text-gray-800">Statut</dt>
                                <dd className="capitalize text-indigo-600">{details?.session.status ?? 'inconnu'}</dd>
                            </div>
                            <div>
                                <dt className="font-medium text-gray-800">Début prévu</dt>
                                <dd>{new Date(details?.session.start_at ?? '').toLocaleString('fr-FR')}</dd>
                            </div>
                            {details?.session.current_viewers !== undefined && (
                                <div>
                                    <dt className="font-medium text-gray-800">Spectateurs actifs</dt>
                                    <dd>{details.session.current_viewers}</dd>
                                </div>
                            )}
                            {details?.session.hls_url && (
                                <div className="break-all">
                                    <dt className="font-medium text-gray-800">URL HLS</dt>
                                    <dd>{details.session.hls_url}</dd>
                                </div>
                            )}
                            {details?.session.fallback_hls_url && (
                                <div className="break-all">
                                    <dt className="font-medium text-gray-800">URL HLS de secours</dt>
                                    <dd>{details.session.fallback_hls_url}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                        <h3 className="font-semibold text-blue-900">Conseils visionnage</h3>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                            <li>Utilisez un casque ou des enceintes pour un meilleur son.</li>
                            <li>En cas de coupure, rechargez la page pour relancer le flux.</li>
                            <li>
                                Si la vidéo reste noire, cliquez sur <strong>Lire</strong> pour forcer le flux HLS.
                            </li>
                        </ul>
                    </div>
                </aside>
            </section>

            {flashSales.length > 0 && (
                <section className="mt-12 space-y-6">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-900">Promotions chrono</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Réservez vos produits favoris avant la fin de l’offre.
                        </p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                        {flashSales.map((sale) => {
                            const linked = sale.linked_service;
                            const image = linked?.cover_media || linked?.gallery?.[0] || PLACEHOLDER_IMAGE;
                            const startsAtMs = new Date(sale.start_at).getTime();
                            const endsAtMs = new Date(sale.end_at).getTime();
                            const isEnded = nowMs >= endsAtMs;
                            const isUpcoming = nowMs < startsAtMs;
                            const timeDiff = isUpcoming ? startsAtMs - nowMs : endsAtMs - nowMs;
                            const statusLabel = isEnded
                                ? 'Terminé'
                                : isUpcoming
                                    ? `Débute dans ${formatRelativeTime(timeDiff)}`
                                    : `En cours · fin dans ${formatRelativeTime(timeDiff)}`;
                            const isSoldOut = sale.reserved_quantity >= sale.stock_target;
                            const ratio =
                                sale.stock_target > 0
                                    ? Math.min(100, Math.round((sale.reserved_quantity / sale.stock_target) * 100))
                                    : 0;
                            const ticket = activeTickets[sale.id];
                            const ticketStatus = ticket?.status;
                            const canReserve =
                                !isEnded &&
                                !isUpcoming &&
                                !isSoldOut &&
                                reservingSaleId !== sale.id &&
                                ticketStatus !== 'pending' &&
                                ticketStatus !== 'confirmed';
                            const buttonLabel = isEnded
                                ? 'Terminé'
                                : isUpcoming
                                    ? 'Bientôt disponible'
                                    : isSoldOut
                                        ? 'Stock épuisé'
                                        : ticketStatus === 'pending'
                                            ? 'Traitement en cours...'
                                            : ticketStatus === 'confirmed'
                                                ? '✅ Réservé'
                                                : reservingSaleId === sale.id
                                                    ? 'Réservation…'
                                                    : user
                                                        ? 'Réserver'
                                                        : 'Se connecter pour réserver';
                            const commentaries =
                                flashSaleCommentaries[sale.id] ?? sale.recent_commentaries ?? [];
                            const recentCommentaries =
                                commentaries.length > 4
                                    ? commentaries.slice(commentaries.length - 4)
                                    : commentaries;

                            return (
                                <article
                                    key={sale.id}
                                    className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg"
                                >
                                    <div className="relative aspect-video bg-gray-100">
                                        <img
                                            src={image}
                                            alt={linked?.title || `Produit ${sale.service_id}`}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                        />
                                        <span className="absolute left-3 top-3 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                                            {statusLabel}
                                        </span>
                                    </div>
                                    <div className="flex flex-1 flex-col gap-4 p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {linked?.title || `Produit #${sale.service_id}`}
                                                </h3>
                                                <p className="mt-1 text-sm text-gray-600">
                                                    Promo&nbsp;:{' '}
                                                    <span className="font-semibold text-indigo-600">
                                                        {sale.promo_price_cfa.toLocaleString('fr-FR', {
                                                            minimumFractionDigits: 0,
                                                        })}{' '}
                                                        CFA
                                                    </span>
                                                </p>
                                                {linked?.price && (
                                                    <p className="text-xs text-gray-500">
                                                        Prix courant : {linked.price}
                                                    </p>
                                                )}
                                            </div>
                                            <Link
                                                to={getServiceDetailRoute(sale.service_id)}
                                                className="inline-flex items-center justify-center rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                                            >
                                                Voir
                                            </Link>
                                        </div>
                                        {linked?.short_description && (
                                            <p className="text-sm text-gray-600 line-clamp-3">
                                                {linked.short_description}
                                            </p>
                                        )}
                                        <div>
                                            <div className="flex items-center justify-between text-xs text-gray-600">
                                                <span>
                                                    Réservations :{' '}
                                                    <span className="font-semibold text-gray-900">
                                                        {sale.reserved_quantity}/{sale.stock_target}
                                                    </span>
                                                </span>
                                                <span>{ratio}%</span>
                                            </div>
                                            <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                                                <div
                                                    className="h-full rounded-full bg-indigo-500 transition-all"
                                                    style={{ width: `${ratio}%` }}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleReserveFlashSale(sale)}
                                            disabled={!canReserve}
                                            className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                                        >
                                            {buttonLabel}
                                        </button>
                                        {recentCommentaries.length > 0 && (
                                            <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                                                <div className="font-semibold text-gray-800">
                                                    Commentaires en direct
                                                </div>
                                                <ul className="mt-2 space-y-1">
                                                    {recentCommentaries.map((entry) => (
                                                        <li key={entry.id} className="flex flex-col">
                                                            <span className="text-[11px] text-gray-500">
                                                                {new Date(entry.created_at).toLocaleTimeString('fr-FR', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                })}{' '}
                                                                ·{' '}
                                                                {entry.created_by === 'ai_voice'
                                                                    ? 'IA'
                                                                    : 'Prestataire'}
                                                            </span>
                                                            <span>{entry.message}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            {linkedServices.length > 0 && (
                <section className="mt-12 space-y-6">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-900">Produits mis en avant</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Accès direct aux fiches produits présentées pendant ce live.
                        </p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                        {linkedServices.map((service) => {
                            const primaryImage =
                                service.cover_media ||
                                service.gallery?.[0] ||
                                PLACEHOLDER_IMAGE;
                            const galleryThumbs =
                                service.gallery?.filter((url) => url !== primaryImage) ?? [];

                            return (
                                <article
                                    key={service.id}
                                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg"
                                >
                                    <div className="relative aspect-video bg-gray-100">
                                        <img
                                            src={primaryImage}
                                            alt={service.title || `Produit ${service.id}`}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="p-5 space-y-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {service.title || `Produit #${service.id}`}
                                                </h3>
                                                {service.price && (
                                                    <p className="text-sm font-medium text-indigo-600">
                                                        {service.price}
                                                    </p>
                                                )}
                                            </div>
                                            <Link
                                                to={getServiceDetailRoute(service.id)}
                                                className="inline-flex items-center justify-center rounded-md border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                                            >
                                                Voir la fiche
                                            </Link>
                                        </div>
                                        {service.short_description && (
                                            <p className="text-sm text-gray-600">
                                                {service.short_description}
                                            </p>
                                        )}
                                        {galleryThumbs.length > 0 && (
                                            <div className="flex gap-2 overflow-x-auto">
                                                {galleryThumbs.slice(0, 4).map((url, index) => (
                                                    <img
                                                        key={`${service.id}-thumb-${index}`}
                                                        src={url}
                                                        alt={`Galerie ${service.title || service.id}`}
                                                        className="h-16 w-20 rounded-md border border-gray-200 object-cover"
                                                        loading="lazy"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
};

export default LiveViewerPage;

