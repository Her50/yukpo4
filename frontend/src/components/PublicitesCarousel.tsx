import {
    ArrowRight,
    Globe,
    MapPin,
    Package,
    Play,
    Tag,
    Volume2,
    VolumeX,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api.config';
import { apiGet, apiPost } from '../services/apiService';
import { trackProductCarousel, trackVideoCarousel } from '../services/metricsTracking';

interface PubliciteVideoMeta {
    format?: string | null;
    source?: string | null;
    duration_ms?: number | null;
    ai_generated?: boolean | null;
}

interface Publicite {
    id: string;
    titre: string;
    description?: string;
    produits: any[];
    zone_geographique?: string;
    raw: any;
    videos_meta?: PubliciteVideoMeta[];
    video_stats?: Record<string, any>;
    videos?: string[]; // ✅ Correction : Ajouter pour correspondre au mapping
    thumbnails?: string[]; // ✅ Correction : Ajouter pour correspondre au mapping
}

interface PublicitesCarouselProps {
    userId?: string;
    userBehavior?: string[];
}

const looksLikeBase64 = (value?: string | null): boolean => {
    if (!value || typeof value !== 'string') {
        return false;
    }
    const sanitized = value.replace(/\s/g, '');
    if (sanitized.startsWith('data:')) {
        return false;
    }
    return sanitized.length > 64 && /^[A-Za-z0-9+/=]+$/.test(sanitized);
};

const buildAssetUrl = (path?: string | null): string | null => {
    if (!path || typeof path !== 'string') {
        return null;
    }
    const trimmed = path.trim();
    if (!trimmed) {
        return null;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (trimmed.startsWith('data:')) {
        return trimmed;
    }
    const baseSource =
        API_BASE_URL && API_BASE_URL.trim().length > 0
            ? API_BASE_URL
            : typeof window !== 'undefined'
                ? window.location.origin
                : '';
    if (!baseSource) {
        return null;
    }
    const base = baseSource.replace(/\/$/, '');
    return `${base}/${trimmed.replace(/^\//, '')}`;
};

const resolveVideoSource = (raw: any): string | null => {
    const candidates: Array<string | null | undefined> = [
        raw?.square_video_url,
        raw?.squareVideoUrl,
        raw?.video_square_url,
        raw?.videoSquareUrl,
        raw?.primary_square_video,
        raw?.video_url,
        raw?.videoUrl,
    ];

    if (Array.isArray(raw?.video_urls)) {
        candidates.push(...raw.video_urls);
    }

    if (Array.isArray(raw?.videos)) {
        const prioritized = raw.videos.filter((video: string) =>
            typeof video === 'string' && (video.toLowerCase().includes('square') || video.toLowerCase().includes('1x1')),
        );
        candidates.push(...prioritized, ...raw.videos);
    }

    const variants = raw?.video_variants || raw?.videoVariants || raw?.additional_outputs;
    if (Array.isArray(variants)) {
        variants.forEach((variant: any) => {
            if (!variant) {
                return;
            }
            const format = String(variant.format || variant.type || '').toLowerCase();
            const url = variant.video_url || variant.url || variant.path;
            if (format.includes('square') || format.includes('1x1') || format.includes('feed') || format.includes('carre')) {
                candidates.push(url);
            }
        });
    } else if (variants && typeof variants === 'object') {
        ['square', '1x1', 'feed', 'carre'].forEach((key) => {
            const value = variants[key];
            if (!value) {
                return;
            }
            if (typeof value === 'string') {
                candidates.push(value);
            } else if (typeof value === 'object') {
                candidates.push(value.video_url || value.url || value.path);
            }
        });
    }

    for (const candidate of candidates) {
        const uri = buildAssetUrl(candidate);
        if (uri && uri.startsWith('http')) {
            return uri;
        }
    }
    return null;
};

const resolveThumbnail = (raw: any): string | null => {
    const candidates: Array<string | null | undefined> = [];

    if (Array.isArray(raw?.thumbnails)) {
        const firstThumb = raw.thumbnails.find((thumb: unknown) => typeof thumb === 'string' && thumb.trim().length > 0);
        if (firstThumb) {
            candidates.push(firstThumb);
        }
    }

    candidates.push(raw?.thumbnail, raw?.preview_image, raw?.previewImage, raw?.cover_image);

    if (Array.isArray(raw?.produits) && raw.produits.length > 0) {
        const firstProduct = raw.produits[0];
        if (Array.isArray(firstProduct?.images)) {
            const firstImage = firstProduct.images.find((img: unknown) => typeof img === 'string' && img.length > 0);
            if (firstImage) {
                candidates.push(
                    firstImage.startsWith('data:image') ? firstImage : `data:image/jpeg;base64,${firstImage}`,
                );
            }
        }
    }

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string') {
            continue;
        }
        if (/^https?:\/\//i.test(candidate) || candidate.startsWith('data:image')) {
            return candidate;
        }
        if (looksLikeBase64(candidate)) {
            return `data:image/jpeg;base64,${candidate}`;
        }
        const uri = buildAssetUrl(candidate);
        if (uri) {
            return uri;
        }
    }
    return null;
};

const getCategoryEmoji = (type?: string): string => {
    const icons: Record<string, string> = {
        immobilier_batiment: '🏠',
        immobilier_terrain: '🏞️',
        hotellerie: '🏨',
        automobile: '🚗',
        ticket_voyage: '🎫',
        telephone: '📱',
        ordinateur: '💻',
        vetement: '👔',
        electromenager: '🔌',
        mobilier: '🪑',
        pharmacie: '💊',
    };
    if (!type) {
        return '📦';
    }
    return icons[type] || '📦';
};

const getPrimaryVideoMeta = (pub: Publicite, hasVideo: boolean): { format: string; source: string } => {
    const metas = Array.isArray(pub.videos_meta) ? pub.videos_meta : [];
    if (metas.length > 0) {
        const preferred =
            metas.find((meta) => {
                const hasFormat = typeof meta.format === 'string' && meta.format.trim().length > 0;
                const hasSource = typeof meta.source === 'string' && meta.source.trim().length > 0;
                return hasFormat || hasSource;
            }) ?? metas[0];

        const aiHint =
            preferred.ai_generated ??
            (typeof preferred.source === 'string' && preferred.source.toLowerCase().includes('ai'));

        const format =
            typeof preferred.format === 'string' && preferred.format.trim().length > 0
                ? preferred.format.trim().toLowerCase()
                : aiHint
                    ? 'square'
                    : hasVideo
                        ? 'video'
                        : 'image';

        const source =
            typeof preferred.source === 'string' && preferred.source.trim().length > 0
                ? preferred.source.trim().toLowerCase()
                : aiHint
                    ? 'ai'
                    : hasVideo
                        ? 'manual'
                        : 'image';

        return { format, source };
    }

    if (hasVideo) {
        return { format: 'video', source: 'unknown' };
    }

    return { format: 'image', source: 'image' };
};

const PublicitesCarousel: React.FC<PublicitesCarouselProps> = ({ userId, userBehavior = [] }) => {
    const [publicites, setPublicites] = useState<Publicite[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const [videoReady, setVideoReady] = useState<Record<string, boolean>>({});
    const [failedVideos, setFailedVideos] = useState<Record<string, boolean>>({});
    const [needsManualPlay, setNeedsManualPlay] = useState<Record<string, boolean>>({});
    const carouselRef = useRef<HTMLDivElement>(null);
    const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
    const viewedRef = useRef<Set<string>>(new Set());
    const viewTimeoutRef = useRef<number | null>(null);
    const navigate = useNavigate();

    const orderedPublicites = useMemo(() => publicites ?? [], [publicites]);

    useEffect(() => {
        const loadPublicites = async () => {
            try {
                setLoading(true);

                const params = new URLSearchParams();
                if (userBehavior.length > 0) {
                    params.append('categories', userBehavior.join(','));
                }
                if (userId) {
                    params.append('user_id', userId);
                }

                const response = await apiGet(`/api/publicites/actives?${params.toString()}`);
                const jsonData = await response.json();

                if (jsonData && (Array.isArray(jsonData) || jsonData.data)) {
                    let pubs = Array.isArray(jsonData) ? jsonData : jsonData.data;

                    if (userBehavior.length > 0 && Array.isArray(pubs)) {
                        pubs = pubs.sort((a: any, b: any) => {
                            const scoreA =
                                a.produits?.filter((p: any) => userBehavior.includes(p.type)).length || 0;
                            const scoreB =
                                b.produits?.filter((p: any) => userBehavior.includes(p.type)).length || 0;
                            return scoreB - scoreA;
                        });
                    }

                    const normalized: Publicite[] = (Array.isArray(pubs) ? pubs : []).map((raw: any) => ({
                        id: String(raw.id ?? raw.publicite_id ?? Math.random().toString(36).slice(2)),
                        titre: raw.titre ?? 'Promotion Yukpo',
                        description: raw.description,
                        produits: Array.isArray(raw.produits) ? raw.produits : [],
                        zone_geographique: raw.zone_geographique ?? raw.zone ?? 'local',
                        raw,
                        videos_meta: Array.isArray(raw.videos_meta) ? raw.videos_meta : [],
                        video_stats: raw.video_stats || {},
                        videos: Array.isArray(raw.videos) ? raw.videos : [],
                        thumbnails: Array.isArray(raw.thumbnails) ? raw.thumbnails : [],
                    }));

                    setPublicites(normalized);
                    setCurrentIndex(0);
                    setVideoReady({});
                    setFailedVideos({});
                    setNeedsManualPlay({});
                    viewedRef.current.clear();
                } else {
                    setPublicites([]);
                }
            } catch (error) {
                console.error('[PublicitesCarousel] Erreur chargement:', error);
                setPublicites([]);
            } finally {
                setLoading(false);
            }
        };

        loadPublicites();
    }, [userBehavior, userId]);

    useEffect(() => {
        if (!carouselRef.current || orderedPublicites.length === 0) {
            return;
        }
        carouselRef.current.scrollTo({
            left: currentIndex * (carouselRef.current.clientWidth + 12),
            behavior: 'smooth',
        });
    }, [currentIndex, orderedPublicites.length]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (orderedPublicites.length <= 1) {
                return;
            }
            setCurrentIndex((prev) => (prev + 1) % orderedPublicites.length);
        }, 6000);

        return () => clearInterval(interval);
    }, [orderedPublicites.length]);

    useEffect(() => {
        orderedPublicites.forEach((pub, index) => {
            const ref = videoRefs.current[pub.id];
            if (!ref) {
                return;
            }
            if (index === currentIndex) {
                const playPromise = ref.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            setNeedsManualPlay((prev) => ({ ...prev, [pub.id]: false }));
                        })
                        .catch(() => {
                            setNeedsManualPlay((prev) => ({ ...prev, [pub.id]: true }));
                        });
                }
            } else {
                ref.pause();
                ref.currentTime = 0;
            }
        });
    }, [currentIndex, orderedPublicites, isMuted]);

    useEffect(() => {
        if (viewTimeoutRef.current) {
            window.clearTimeout(viewTimeoutRef.current);
            viewTimeoutRef.current = null;
        }

        const active = orderedPublicites[currentIndex];
        if (!active) {
            return;
        }
        if (viewedRef.current.has(active.id)) {
            return;
        }

        viewTimeoutRef.current = window.setTimeout(() => {
            viewedRef.current.add(active.id);
            const hasVideo = Boolean(resolveVideoSource(active.raw));
            const primaryMeta = getPrimaryVideoMeta(active, hasVideo);
            apiPost('/api/publicites/track-view', {
                publicite_id: Number(active.id),
                user_id: userId,
                video_format: primaryMeta.format,
                video_source: primaryMeta.source,
            }).catch(() => undefined);
        }, 1500);

        return () => {
            if (viewTimeoutRef.current) {
                window.clearTimeout(viewTimeoutRef.current);
                viewTimeoutRef.current = null;
            }
        };
    }, [currentIndex, orderedPublicites, userId]);

    const handlePubliciteClick = async (pub: Publicite) => {
        try {
            const hasVideo = Boolean(resolveVideoSource(pub.raw));
            const primaryMeta = getPrimaryVideoMeta(pub, hasVideo);

            // ✅ Tracking métriques : Clic sur publicité
            if (hasVideo) {
                trackVideoCarousel('engagement', 'publicites-carousel', pub.id, undefined);
            } else {
                trackProductCarousel('click', 'publicites-carousel', pub.id);
            }

            await apiPost('/api/publicites/track-click', {
                publicite_id: Number(pub.id),
                user_id: userId,
                video_format: primaryMeta.format,
                video_source: primaryMeta.source,
            });

            if (pub.produits && pub.produits.length > 0) {
                const firstProduct = pub.produits[0];

                if (firstProduct.serviceId) {
                    navigate(`/service/${firstProduct.serviceId}`);
                }
            }
        } catch (error) {
            console.error('[PublicitesCarousel] Erreur tracking clic:', error);
        }
    };

    const handleRetryVideo = (cardId: string, videoUrl: string | null) => {
        if (!videoUrl) {
            return;
        }
        setFailedVideos((prev) => ({ ...prev, [cardId]: false }));
        setNeedsManualPlay((prev) => ({ ...prev, [cardId]: false }));

        const ref = videoRefs.current[cardId];
        if (ref) {
            ref.load();
            ref.play()
                .then(() => {
                    setNeedsManualPlay((prev) => ({ ...prev, [cardId]: false }));
                })
                .catch(() => {
                    setNeedsManualPlay((prev) => ({ ...prev, [cardId]: true }));
                });
        }
    };

    const handleManualPlay = (cardId: string) => {
        const ref = videoRefs.current[cardId];
        if (!ref) {
            return;
        }
        ref.play()
            .then(() => {
                setNeedsManualPlay((prev) => ({ ...prev, [cardId]: false }));
            })
            .catch(() => {
                setNeedsManualPlay((prev) => ({ ...prev, [cardId]: true }));
            });
    };

    if (loading || orderedPublicites.length === 0) {
        return null;
    }

    return (
        <div className="mb-10">
            <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    ✨ Promotions du moment
                </h2>
                <p className="text-sm text-gray-600">
                    {userBehavior.length > 0 ? 'Sélectionnées pour vous' : 'Découvrez les offres'}
                </p>
            </div>

            <div
                ref={carouselRef}
                className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-4 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onScroll={(e) => {
                    // ✅ Tracking métriques : Scroll carrousel
                    const target = e.target as HTMLElement;
                    const scrollLeft = target.scrollLeft;
                    const cardWidth = target.clientWidth * 0.85 + 24; // 85% width + gap
                    const currentIndex = Math.round(scrollLeft / cardWidth);
                    if (currentIndex !== currentIndex) {
                        trackVideoCarousel('scroll', 'publicites-carousel');
                    }
                }}
            >
                {orderedPublicites.map((pub, index) => {
                    const videoUrl = resolveVideoSource(pub.raw);
                    const thumbnailUrl = resolveThumbnail(pub.raw);
                    const isActive = index === currentIndex;
                    const isVideoFailed = failedVideos[pub.id];
                    const requiresManualPlay = needsManualPlay[pub.id];

                    return (
                        <div
                            key={pub.id}
                            className="flex-shrink-0 w-[85%] md:w-[420px] snap-center cursor-pointer group"
                            onClick={() => handlePubliciteClick(pub)}
                        >
                            <div className="bg-white border border-gray-100 rounded-3xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                                <div className="relative aspect-square bg-slate-950">
                                    {videoUrl && !isVideoFailed ? (
                                        <>
                                            <video
                                                ref={(ref) => {
                                                    videoRefs.current[pub.id] = ref;
                                                }}
                                                src={videoUrl}
                                                muted={isMuted}
                                                loop
                                                playsInline
                                                preload="metadata"
                                                className="w-full h-full object-cover"
                                                onLoadedData={() => {
                                                    setVideoReady((prev) => ({ ...prev, [pub.id]: true }));
                                                    // ✅ Tracking métriques : Vidéo chargée
                                                    trackVideoCarousel('view', 'publicites-carousel', pub.id);
                                                }}
                                                onPlay={() => {
                                                    // ✅ Tracking métriques : Play vidéo
                                                    trackVideoCarousel('play', 'publicites-carousel', pub.id);
                                                }}
                                                onPause={() => {
                                                    // ✅ Tracking métriques : Pause vidéo
                                                    trackVideoCarousel('pause', 'publicites-carousel', pub.id);
                                                }}
                                                onError={() => {
                                                    setFailedVideos((prev) => ({ ...prev, [pub.id]: true }));
                                                }}
                                            />
                                            {!videoReady[pub.id] && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45">
                                                    <div className="w-9 h-9 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                </div>
                                            )}
                                            {requiresManualPlay && (
                                                <button
                                                    type="button"
                                                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 text-white font-semibold"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleManualPlay(pub.id);
                                                    }}
                                                >
                                                    <Play className="w-8 h-8" />
                                                    <span className="text-xs uppercase tracking-wide">
                                                        Relancer la vidéo
                                                    </span>
                                                </button>
                                            )}
                                            <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                                                <span className="px-3 py-1 text-xs font-semibold text-white bg-slate-950/60 rounded-full border border-white/10">
                                                    Format carré 1:1
                                                </span>
                                                <button
                                                    type="button"
                                                    className="w-9 h-9 rounded-full bg-slate-950/60 text-white flex items-center justify-center hover:bg-slate-900/70 transition-colors"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setIsMuted((prev) => !prev);
                                                    }}
                                                    aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
                                                >
                                                    {isMuted ? (
                                                        <VolumeX className="w-4 h-4" />
                                                    ) : (
                                                        <Volume2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </>
                                    ) : thumbnailUrl ? (
                                        <img
                                            src={thumbnailUrl}
                                            alt={pub.titre}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/50">
                                            <Package className="w-14 h-14" />
                                        </div>
                                    )}

                                    {isVideoFailed && (
                                        <button
                                            type="button"
                                            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 text-white font-semibold"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleRetryVideo(pub.id, videoUrl);
                                            }}
                                        >
                                            <span className="px-3 py-1 text-xs font-semibold text-white bg-white/10 rounded-full border border-white/20">
                                                Vidéo indisponible
                                            </span>
                                            <span className="text-xs uppercase tracking-wide">
                                                Réessayer
                                            </span>
                                        </button>
                                    )}

                                    {pub.produits?.[0]?.type ? (
                                        <div className="absolute top-4 left-4 w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-lg">
                                            {getCategoryEmoji(pub.produits[0].type)}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="p-5 flex flex-col gap-4">
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-bold text-gray-900 line-clamp-2">
                                            {pub.titre}
                                        </h3>
                                        {pub.description ? (
                                            <p className="text-sm text-gray-600 line-clamp-2">{pub.description}</p>
                                        ) : null}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                        <span className="flex items-center gap-2 font-semibold">
                                            <Package className="w-4 h-4 text-indigo-500" />
                                            {(pub.produits?.length || 0).toString()} produit
                                            {(pub.produits?.length || 0) > 1 ? 's' : ''}
                                        </span>
                                        {pub.produits?.[0]?.prix ? (
                                            <span className="flex items-center gap-2 font-semibold">
                                                <Tag className="w-4 h-4 text-indigo-500" />
                                                À partir de {pub.produits[0].prix} FCFA
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">
                                            {pub.zone_geographique === 'local' ? (
                                                <MapPin className="w-4 h-4" />
                                            ) : (
                                                <Globe className="w-4 h-4" />
                                            )}
                                            {pub.zone_geographique === 'local'
                                                ? 'Local'
                                                : pub.zone_geographique === 'regional'
                                                    ? 'Régional'
                                                    : 'International'}
                                        </span>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                                        >
                                            Voir le produit
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div
                                    className={`h-1 ${isActive ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500' : 'bg-gray-100'}`}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {orderedPublicites.length > 1 ? (
                <div className="flex justify-center gap-3 mt-4">
                    {orderedPublicites.map((pub, index) => (
                        <button
                            key={pub.id}
                            type="button"
                            onClick={() => setCurrentIndex(index)}
                            className={`h-2 rounded-full transition-all ${index === currentIndex
                                ? 'w-8 bg-indigo-600'
                                : 'w-2 bg-gray-300 hover:bg-gray-400'
                                }`}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export default PublicitesCarousel;


