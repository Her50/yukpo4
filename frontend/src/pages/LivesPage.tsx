import { ROUTES, getLiveViewRoute } from '@/routes/AppRoutesRegistry';
import { fetchUpcomingLives } from '@/services/liveApi';
import type { LiveSession } from '@/types/live';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

interface LiveItem extends LiveSession {
    formattedStartAt: string;
}

const LivesPage: React.FC = () => {
    const [lives, setLives] = useState<LiveItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadLives = async () => {
            setLoading(true);
            setError(null);

            try {
                const data = await fetchUpcomingLives(12);
                if (!mounted) return;

                const enhanced = data.map((item) => ({
                    ...item,
                    formattedStartAt: new Date(item.start_at).toLocaleString('fr-FR', {
                        weekday: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'long',
                    }),
                }));
                setLives(enhanced);
            } catch (err) {
                console.error('[LivesPage] Unable to fetch live sessions', err);
                if (mounted) {
                    setError("Impossible de récupérer les lives pour le moment.");
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadLives();

        return () => {
            mounted = false;
        };
    }, []);

    const upcoming = useMemo(
        () => lives.filter((live) => live.status !== 'replay_ready'),
        [lives],
    );
    const replays = useMemo(
        () => lives.filter((live) => live.status === 'replay_ready'),
        [lives],
    );

    const getLinkedCount = (live: LiveItem): number => {
        const metadata = live.metadata as { linked_services?: unknown } | undefined;
        const linked = metadata?.linked_services;
        if (Array.isArray(linked)) {
            return linked.length;
        }
        return 0;
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-12">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Lives Yukpo</h1>
                    <p className="mt-2 text-gray-600">
                        Retrouvez les lives produits à venir et accédez aux replays disponibles.
                    </p>
                </div>
                <Link
                    to={ROUTES.LIVE_GO_LIVE}
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                    Démarrer un live
                </Link>
            </header>

            {loading && (
                <div className="mt-10 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-600">
                    Chargement des lives en cours…
                </div>
            )}

            {error && (
                <div className="mt-10 rounded-lg border border-red-300 bg-red-50 p-6 text-red-700">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    <section className="mt-10">
                        <h2 className="text-2xl font-semibold text-gray-900">Lives à venir</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Recevez un rappel avant le démarrage et profitez d’une expérience interactive en direct.
                        </p>

                        {upcoming.length === 0 ? (
                            <div className="mt-6 rounded-md border border-gray-200 bg-white p-6 text-gray-600">
                                Aucun live programmé pour le moment. Revenez bientôt ou lancez le vôtre !
                            </div>
                        ) : (
                            <ul className="mt-6 grid gap-6 md:grid-cols-2">
                                {upcoming.map((live) => {
                                    const linkedCount = getLinkedCount(live);
                                    return (
                                        <li
                                            key={live.id}
                                            className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-lg"
                                        >
                                            <div>
                                                <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                                                    {live.status === 'scheduled' ? 'Programmé' : 'Live bientôt'}
                                                </span>
                                                <h3 className="mt-3 text-lg font-semibold text-gray-900">{live.title}</h3>
                                                {live.description && (
                                                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                                                        {live.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="mt-6 flex flex-col gap-2 text-sm text-gray-600">
                                                <div>
                                                    <span className="font-medium text-gray-800">Début :</span>{' '}
                                                    {live.formattedStartAt}
                                                </div>
                                                {live.hls_url && (
                                                    <div className="truncate">
                                                        <span className="font-medium text-gray-800">HLS :</span>{' '}
                                                        <a
                                                            href={live.hls_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:underline"
                                                        >
                                                            Ouvrir le flux
                                                        </a>
                                                    </div>
                                                )}
                                                {live.fallback_hls_url && (
                                                    <div className="truncate">
                                                        <span className="font-medium text-gray-800">Fallback :</span>{' '}
                                                        <a
                                                            href={live.fallback_hls_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:underline"
                                                        >
                                                            Flux alternatif
                                                        </a>
                                                    </div>
                                                )}
                                                {linkedCount > 0 && (
                                                    <span className="inline-flex w-fit items-center justify-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                                                        {linkedCount} produit{linkedCount > 1 ? 's' : ''} mis en avant
                                                    </span>
                                                )}
                                                <Link
                                                    to={getLiveViewRoute(live.id)}
                                                    className="mt-4 inline-flex w-fit items-center justify-center rounded-md border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                                                >
                                                    Voir le live
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <section className="mt-14">
                        <h2 className="text-2xl font-semibold text-gray-900">Replays disponibles</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Visionnez les replays enregistrés et partagez-les avec votre audience.
                        </p>

                        {replays.length === 0 ? (
                            <div className="mt-6 rounded-md border border-gray-200 bg-white p-6 text-gray-600">
                                Aucun replay n’est disponible pour le moment.
                            </div>
                        ) : (
                            <ul className="mt-6 grid gap-6 md:grid-cols-2">
                                {replays.map((live) => {
                                    const linkedCount = getLinkedCount(live);
                                    return (
                                        <li
                                            key={live.id}
                                            className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-lg"
                                        >
                                            <div>
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                                                    Replay
                                                </span>
                                                <h3 className="mt-3 text-lg font-semibold text-gray-900">{live.title}</h3>
                                                {live.description && (
                                                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                                                        {live.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="mt-6 flex flex-col gap-2 text-sm text-gray-600">
                                                <div>
                                                    <span className="font-medium text-gray-800">Diffusé le :</span>{' '}
                                                    {new Date(live.start_at).toLocaleDateString('fr-FR')}
                                                </div>
                                                {live.hls_url && (
                                                    <a
                                                        href={live.hls_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                                    >
                                                        Regarder le replay
                                                    </a>
                                                )}
                                                {!live.hls_url && live.fallback_hls_url && (
                                                    <a
                                                        href={live.fallback_hls_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                                    >
                                                        Regarder le replay (fallback)
                                                    </a>
                                                )}
                                                {live.stream_key && (
                                                    <div className="truncate text-xs text-gray-500">
                                                        <span className="font-medium text-gray-700">Stream key :</span> {live.stream_key}
                                                    </div>
                                                )}
                                                {linkedCount > 0 && (
                                                    <span className="inline-flex w-fit items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                                                        {linkedCount} produit{linkedCount > 1 ? 's' : ''} en boutique
                                                    </span>
                                                )}
                                                <Link
                                                    to={getLiveViewRoute(live.id)}
                                                    className="inline-flex items-center justify-center rounded-md border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                                                >
                                                    Ouvrir dans le player
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default LivesPage;

