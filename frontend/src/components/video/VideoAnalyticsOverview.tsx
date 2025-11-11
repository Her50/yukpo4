import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    fetchContentAnalytics,
    fetchLiveAnalytics,
    fetchVideoAnalyticsOverview,
} from '@/services/videoAnalytics';
import type {
    ContentAnalyticsBreakdown,
    ContentAnalyticsPayload,
    ContentAnalyticsTopContent,
    LiveSessionAnalytics,
    LiveSessionRecord,
    VideoAnalyticsOverview,
} from '@/types/analytics';

type LiveAnalyticsEntry = {
    session: LiveSessionRecord;
    metrics: LiveSessionAnalytics;
};

type AnalyticsTab = 'content' | 'live';

interface VideoAnalyticsOverviewProps {
    className?: string;
    days?: number;
    limit?: number;
}

const DEFAULT_DAYS = 7;
const DEFAULT_LIMIT = 20;

const formatCount = (value: number, locale: string): string => {
    if (!Number.isFinite(value)) {
        return '0';
    }

    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }

    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }

    return new Intl.NumberFormat(locale).format(Math.round(value));
};

const formatPercent = (value: number): string => {
    if (!Number.isFinite(value)) {
        return '0.0%';
    }
    return `${(value * 100).toFixed(1)}%`;
};

const formatSeconds = (seconds: number, t: (key: string, opts?: Record<string, any>) => string): string => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return `0 ${t('video.analytics.units.secondsShort')}`;
    }
    if (seconds >= 3600) {
        return `${(seconds / 3600).toFixed(1)} ${t('video.analytics.units.hoursShort')}`;
    }
    if (seconds >= 60) {
        return `${(seconds / 60).toFixed(1)} ${t('video.analytics.units.minutesShort')}`;
    }
    return `${seconds.toFixed(0)} ${t('video.analytics.units.secondsShort')}`;
};

const formatMilliseconds = (milliseconds: number, t: (key: string) => string): string => {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
        return `0 ${t('video.analytics.units.secondsShort')}`;
    }
    return formatSeconds(milliseconds / 1000, t);
};

const currencyFormatter = (locale: string, currencyLabel: string) => (value: number) => {
    if (!Number.isFinite(value)) {
        return `0 ${currencyLabel}`;
    }

    const safeLocale = locale || 'fr-FR';
    return `${new Intl.NumberFormat(safeLocale).format(Math.round(value))} ${currencyLabel}`;
};

export const VideoAnalyticsOverviewSection = ({
    className,
    days = DEFAULT_DAYS,
    limit = DEFAULT_LIMIT,
}: VideoAnalyticsOverviewProps) => {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('content');
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<VideoAnalyticsOverview | null>(null);
    const [contentAnalytics, setContentAnalytics] = useState<ContentAnalyticsPayload | null>(null);
    const [liveAnalytics, setLiveAnalytics] = useState<LiveAnalyticsEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [liveError, setLiveError] = useState<string | null>(null);

    const locale = useMemo(() => (i18n.language ? i18n.language : 'fr'), [i18n.language]);
    const normalizedCurrencyLocale = useMemo(() => {
        if (!locale) return 'fr-FR';
        if (locale.includes('-')) return locale;
        if (locale === 'en') return 'en-US';
        if (locale === 'fr') return 'fr-FR';
        return `${locale}-${locale.toUpperCase()}`;
    }, [locale]);
    const formatCurrency = useMemo(
        () => currencyFormatter(normalizedCurrencyLocale, t('video.analytics.units.cfa')),
        [normalizedCurrencyLocale, t],
    );

    useEffect(() => {
        let isMounted = true;
        const loadAnalytics = async () => {
            try {
                setLoading(true);
                setError(null);
                setLiveError(null);

                const [overviewData, contentData, liveData] = await Promise.allSettled([
                    fetchVideoAnalyticsOverview({ days }),
                    fetchContentAnalytics({ days, limit }),
                    fetchLiveAnalytics({ limit }),
                ]);

                if (!isMounted) return;

                if (overviewData.status === 'fulfilled') {
                    setOverview(overviewData.value);
                } else {
                    setOverview(null);
                    setError(
                        overviewData.reason instanceof Error
                            ? overviewData.reason.message
                            : t('video.analytics.error.overviewFetch'),
                    );
                }

                if (contentData.status === 'fulfilled') {
                    setContentAnalytics(contentData.value);
                } else {
                    setContentAnalytics(null);
                    setError((prev) => prev || (contentData.reason instanceof Error
                        ? contentData.reason.message
                        : t('video.analytics.error.contentFetch')));
                }

                if (liveData.status === 'fulfilled') {
                    setLiveAnalytics(liveData.value);
                } else {
                    setLiveAnalytics([]);
                    setLiveError(
                        liveData.reason instanceof Error
                            ? liveData.reason.message
                            : t('video.analytics.error.liveFetch'),
                    );
                }
            } catch (err) {
                if (!isMounted) return;
                console.error('[VideoAnalyticsOverview] fetch error', err);
                const defaultMessage =
                    err instanceof Error ? err.message : t('video.analytics.error.generic');
                setError(defaultMessage);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadAnalytics();
        return () => {
            isMounted = false;
        };
    }, [days, limit, t]);

    const successPercent = useMemo(() => {
        if (!overview) return 0;
        const total = overview.distribution_success + overview.distribution_pending;
        if (total === 0) return 0;
        return Math.round((overview.distribution_success / total) * 100);
    }, [overview]);

    const renderOverviewCard = () => {
        if (!overview && !error) {
            return null;
        }

        if (!overview && error) {
            return (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {t(error)}
                </div>
            );
        }

        if (!overview) {
            return null;
        }

        return (
            <section
                aria-label={t('video.analytics.overview.title')}
                className="rounded-3xl border border-indigo-500/20 bg-slate-950/70 p-6 shadow-lg shadow-indigo-900/20 backdrop-blur"
            >
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-semibold text-indigo-100">
                        {t('video.analytics.overview.title')}
                    </h3>
                    <p className="text-sm text-indigo-300/80">
                        {t('video.analytics.overview.horizon', { days: overview.horizon_days })}
                    </p>
                </header>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <article className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                        <p className="text-sm text-indigo-200/80">
                            {t('video.analytics.overview.generated')}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-indigo-50">
                            {formatCount(overview.videos_generated, locale)}
                        </p>
                    </article>
                    <article className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
                        <p className="text-sm text-sky-200/80">
                            {t('video.analytics.overview.views')}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-sky-50">
                            {formatCount(overview.total_views, locale)}
                        </p>
                    </article>
                    <article className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <p className="text-sm text-emerald-200/80">
                            {t('video.analytics.overview.shares')}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-50">
                            {formatCount(overview.total_shares, locale)}
                        </p>
                    </article>
                </div>

                <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-indigo-500/20 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-slate-300">
                        {t('video.analytics.overview.qualityLabel')}
                    </span>
                    <span className="text-xl font-semibold text-cyan-300">
                        {overview.average_quality_score.toFixed(1)} / 5
                    </span>
                </div>

                <div className="mt-6 space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-emerald-200/80">
                            {t('video.analytics.overview.distributionLabel')}
                        </p>
                        <p className="text-sm font-medium text-emerald-200">
                            {t('video.analytics.overview.successRate', { percent: successPercent })}
                        </p>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900/60">
                        <div
                            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                            style={{ width: `${successPercent}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs text-emerald-200/80">
                        <span>
                            {t('video.analytics.overview.published', {
                                count: formatCount(overview.distribution_success, locale),
                            })}
                        </span>
                        <span>
                            {t('video.analytics.overview.pending', {
                                count: formatCount(overview.distribution_pending, locale),
                            })}
                        </span>
                    </div>
                </div>
            </section>
        );
    };

    const renderSummaryCards = () => {
        if (!contentAnalytics) {
            return null;
        }

        const summary = contentAnalytics.summary;
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-sm text-slate-300">
                        {t('video.analytics.summary.impressions')}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-50">
                        {formatCount(summary.impressions, locale)}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-sm text-slate-300">{t('video.analytics.summary.clicks')}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-50">
                        {formatCount(summary.clicks, locale)}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-sm text-slate-300">{t('video.analytics.summary.ctr')}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-50">
                        {formatPercent(summary.ctr)}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                    <p className="text-sm text-slate-300">
                        {t('video.analytics.summary.avgDuration')}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-50">
                        {formatMilliseconds(summary.avg_view_duration_ms, t)}
                    </p>
                </div>
            </div>
        );
    };

    const renderBreakdown = (breakdown: ContentAnalyticsBreakdown[]) => {
        if (!breakdown.length) return null;
        return (
            <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <header className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-slate-100">
                        {t('video.analytics.breakdown.title')}
                    </h4>
                </header>
                <div className="grid gap-4 md:grid-cols-2">
                    {breakdown.map((item) => (
                        <article
                            key={`${item.content_type}-${item.impressions}`}
                            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                        >
                            <p className="text-sm font-semibold text-indigo-200">
                                {item.content_type === 'paid'
                                    ? t('video.analytics.breakdown.type.paid')
                                    : t('video.analytics.breakdown.type.organic')}
                            </p>
                            <dl className="mt-3 space-y-2 text-sm text-slate-300">
                                <div className="flex items-center justify-between">
                                    <dt>{t('video.analytics.breakdown.impressions')}</dt>
                                    <dd className="font-medium text-slate-50">
                                        {formatCount(item.impressions, locale)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt>{t('video.analytics.breakdown.ctr')}</dt>
                                    <dd className="font-medium text-slate-50">
                                        {formatPercent(item.ctr)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt>{t('video.analytics.breakdown.avgDuration')}</dt>
                                    <dd className="font-medium text-slate-50">
                                        {formatMilliseconds(item.avg_view_duration_ms, t)}
                                    </dd>
                                </div>
                            </dl>
                        </article>
                    ))}
                </div>
            </section>
        );
    };

    const renderTopContent = (items: ContentAnalyticsTopContent[]) => {
        if (!items.length) {
            return null;
        }

        return (
            <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <header className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-slate-100">
                        {t('video.analytics.top.title')}
                    </h4>
                </header>
                <div className="grid gap-4 lg:grid-cols-2">
                    {items.slice(0, 4).map((item) => (
                        <article
                            key={item.content_id}
                            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                        >
                            <header className="flex items-center justify-between gap-3">
                                <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-200">
                                    {item.content_type === 'paid'
                                        ? t('video.analytics.breakdown.type.paid')
                                        : t('video.analytics.breakdown.type.organic')}
                                </span>
                                {item.last_seen ? (
                                    <span className="text-xs text-slate-400">
                                        {t('video.analytics.top.seenAt', {
                                            date: new Date(item.last_seen).toLocaleString(),
                                        })}
                                    </span>
                                ) : null}
                            </header>
                            <p className="mt-3 text-sm text-slate-400">{item.content_id}</p>
                            <dl className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-300">
                                <div>
                                    <dt>{t('video.analytics.top.labels.impressions')}</dt>
                                    <dd className="mt-1 text-sm font-semibold text-slate-50">
                                        {formatCount(item.impressions, locale)}
                                    </dd>
                                </div>
                                <div>
                                    <dt>{t('video.analytics.top.labels.ctr')}</dt>
                                    <dd className="mt-1 text-sm font-semibold text-slate-50">
                                        {formatPercent(item.ctr)}
                                    </dd>
                                </div>
                                <div>
                                    <dt>{t('video.analytics.top.labels.duration')}</dt>
                                    <dd className="mt-1 text-sm font-semibold text-slate-50">
                                        {formatMilliseconds(item.avg_view_duration_ms, t)}
                                    </dd>
                                </div>
                            </dl>
                            <dl className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-300">
                                <div>
                                    <dt>{t('video.analytics.top.labels.likes')}</dt>
                                    <dd className="mt-1 text-sm font-semibold text-slate-50">
                                        {formatCount(item.likes, locale)}
                                    </dd>
                                </div>
                                <div>
                                    <dt>{t('video.analytics.top.labels.saves')}</dt>
                                    <dd className="mt-1 text-sm font-semibold text-slate-50">
                                        {formatCount(item.saves, locale)}
                                    </dd>
                                </div>
                                <div>
                                    <dt>{t('video.analytics.top.labels.clicks')}</dt>
                                    <dd className="mt-1 text-sm font-semibold text-slate-50">
                                        {formatCount(item.clicks, locale)}
                                    </dd>
                                </div>
                            </dl>
                        </article>
                    ))}
                </div>
            </section>
        );
    };

    const renderLiveList = () => {
        if (liveAnalytics.length === 0) {
            return (
                <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
                    {t('video.analytics.live.empty')}{' '}
                    {t('video.analytics.live.emptyHint')}
                </div>
            );
        }

        return (
            <div className="grid gap-4 lg:grid-cols-2">
                {liveAnalytics.map(({ session, metrics }) => (
                    <article
                        key={session.id}
                        className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5"
                    >
                        <header className="flex items-start justify-between gap-3">
                            <div>
                                <h4 className="text-base font-semibold text-slate-100">
                                    {session.title}
                                </h4>
                                <p className="mt-1 text-xs text-slate-400">
                                    {new Date(session.start_at).toLocaleString()}
                                </p>
                            </div>
                            <span
                                className={clsx(
                                    'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                                    session.status === 'live'
                                        ? 'bg-emerald-500/10 text-emerald-300'
                                        : 'bg-slate-500/10 text-slate-300',
                                )}
                            >
                                {t(`video.analytics.live.status.${session.status}`)}
                            </span>
                        </header>

                        <dl className="mt-4 grid gap-3 text-xs text-slate-300 md:grid-cols-3">
                            <div>
                                <dt>{t('video.analytics.live.metrics.audienceTotal')}</dt>
                                <dd className="mt-1 text-sm font-semibold text-slate-50">
                                    {formatCount(metrics.total_viewers, locale)}
                                </dd>
                            </div>
                            <div>
                                <dt>{t('video.analytics.live.metrics.hls')}</dt>
                                <dd className="mt-1 text-sm font-semibold text-slate-50">
                                    {formatCount(metrics.hls_viewers, locale)}
                                </dd>
                            </div>
                            <div>
                                <dt>{t('video.analytics.live.metrics.webrtc')}</dt>
                                <dd className="mt-1 text-sm font-semibold text-slate-50">
                                    {formatCount(metrics.webrtc_viewers, locale)}
                                </dd>
                            </div>
                        </dl>

                        <dl className="mt-4 grid gap-3 text-xs text-slate-300 md:grid-cols-3">
                            <div>
                                <dt>{t('video.analytics.live.metrics.totalWatchTime')}</dt>
                                <dd className="mt-1 text-sm font-semibold text-slate-50">
                                    {formatSeconds(metrics.total_watch_time_seconds, t)}
                                </dd>
                            </div>
                            <div>
                                <dt>{t('video.analytics.live.metrics.avgWatchTime')}</dt>
                                <dd className="mt-1 text-sm font-semibold text-slate-50">
                                    {formatSeconds(metrics.average_watch_time_seconds, t)}
                                </dd>
                            </div>
                            <div>
                                <dt>{t('video.analytics.live.metrics.conversions')}</dt>
                                <dd className="mt-1 text-sm font-semibold text-slate-50">
                                    {formatCount(metrics.conversions, locale)}
                                </dd>
                            </div>
                        </dl>

                        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                            <span className="font-semibold text-amber-100">
                                {t('video.analytics.live.metrics.revenue')}
                            </span>
                            <span className="ml-2">{formatCurrency(metrics.revenue_cfa)}</span>
                        </div>
                    </article>
                ))}
            </div>
        );
    };

    const renderContentTab = () => {
        if (!contentAnalytics && error) {
            return (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {t(error)}
                </div>
            );
        }

        if (!contentAnalytics) {
            return null;
        }

        return (
            <div className="space-y-6">
                {renderSummaryCards()}
                {renderBreakdown(contentAnalytics.breakdown)}
                {renderTopContent(contentAnalytics.top_content)}
            </div>
        );
    };

    const renderLiveTab = () => {
        if (liveError) {
            return (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
                    {t(liveError)}
                </div>
            );
        }

        return renderLiveList();
    };

    const renderTabs = () => (
        <div
            role="tablist"
            aria-label={t('video.analytics.tabs.ariaLabel')}
            className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-2"
        >
            {(['content', 'live'] as AnalyticsTab[]).map((tab) => (
                <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    className={clsx(
                        'flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition',
                        activeTab === tab
                            ? 'bg-indigo-500/20 text-indigo-100 shadow-inner'
                            : 'text-slate-300 hover:bg-slate-800/60',
                    )}
                    onClick={() => setActiveTab(tab)}
                >
                    {tab === 'content'
                        ? t('video.analytics.tabs.content')
                        : t('video.analytics.tabs.live')}
                </button>
            ))}
        </div>
    );

    if (loading) {
        return (
            <section className={clsx('space-y-6', className)}>
                <div className="animate-pulse rounded-3xl border border-indigo-500/20 bg-slate-950/50 p-6">
                    <div className="h-6 w-40 rounded bg-slate-800" />
                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        {[0, 1, 2].map((item) => (
                            <div key={item} className="h-24 rounded-2xl bg-slate-900" />
                        ))}
                    </div>
                    <div className="mt-6 h-12 rounded-2xl bg-slate-900" />
                </div>
            </section>
        );
    }

    return (
        <section className={clsx('space-y-6', className)}>
            {renderOverviewCard()}
            {renderTabs()}
            <div>{activeTab === 'content' ? renderContentTab() : renderLiveTab()}</div>
        </section>
    );
};

export default VideoAnalyticsOverviewSection;
