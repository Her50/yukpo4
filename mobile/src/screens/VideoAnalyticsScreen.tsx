import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { SafeNativeView } from '../components/SafeNativeView';
import { useLanguageSafe } from '../contexts/LanguageContext';
import {
    analyticsApi,
    ContentAnalyticsApiData,
    VideoAnalyticsOverview,
    VideoAnalyticsOverviewResponse
} from '../services/api';
import liveMarketingService from '../services/liveMarketingService';
import liveStreamingService, {
    LiveSessionAnalyticsRecord,
    LiveSessionRecord
} from '../services/liveStreamingService';

const DEFAULT_DAYS = 7;
const DEFAULT_LIMIT = 25;

interface LiveAnalyticsItem {
    session: LiveSessionRecord;
    metrics: LiveSessionAnalyticsRecord;
}

const formatCount = (value: number): string => {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toString();
};

const formatPercent = (value: number): string => {
    if (!Number.isFinite(value)) {
        return '0.0%';
    }
    return `${(value * 100).toFixed(1)}%`;
};

const formatLiveDate = (isoString: string): string => {
    if (!isoString) {
        return '';
    }
    try {
        return new Date(isoString).toLocaleString();
    } catch {
        return isoString;
    }
};

const isVideoAnalyticsOverview = (value: unknown): value is VideoAnalyticsOverview => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as VideoAnalyticsOverview;
    return (
        typeof candidate.horizon_days === 'number' &&
        typeof candidate.videos_generated === 'number' &&
        typeof candidate.total_views === 'number' &&
        typeof candidate.total_shares === 'number'
    );
};

const isVideoAnalyticsOverviewResponse = (
    value: unknown
): value is VideoAnalyticsOverviewResponse => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as VideoAnalyticsOverviewResponse;
    return typeof candidate.success === 'boolean' && isVideoAnalyticsOverview(candidate.data);
};

const VideoAnalyticsScreen: React.FC = () => {
    const { t, language } = useLanguageSafe();
    const [data, setData] = useState<ContentAnalyticsApiData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [liveAnalytics, setLiveAnalytics] = useState<LiveAnalyticsItem[]>([]);
    const [liveError, setLiveError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'content' | 'live'>('content');
    const [marketingVisible, setMarketingVisible] = useState(false);
    const [marketingLoading, setMarketingLoading] = useState(false);
    const [marketingResult, setMarketingResult] = useState<any>(null);
    const [marketingType, setMarketingType] = useState<'teaser' | 'invites' | 'followup' | null>(null);
    const [marketingSession, setMarketingSession] = useState<LiveSessionRecord | null>(null);
    const [marketingError, setMarketingError] = useState<string | null>(null);
    const [videoOverview, setVideoOverview] = useState<VideoAnalyticsOverview | null>(null);
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const silentFetchRef = useRef(false);

    const formatLiveStatus = useCallback(
        (status: string): string => {
            const normalized = (status || '').toLowerCase();
            switch (normalized) {
                case 'live':
                    return t('video.analytics.live.status.live');
                case 'scheduled':
                    return t('video.analytics.live.status.scheduled');
                case 'replay_ready':
                    return t('video.analytics.live.status.replayReady');
                case 'ended':
                    return t('video.analytics.live.status.ended');
                default:
                    return status || t('video.analytics.live.status.unknown');
            }
        },
        [t]
    );

    const formatDuration = useCallback(
        (value: number): string => {
            if (!Number.isFinite(value) || value <= 0) {
                return `0 ${t('video.analytics.units.secondsShort')}`;
            }
            const seconds = value / 1000;
            return `${seconds.toFixed(1)} ${t('video.analytics.units.secondsShort')}`;
        },
        [t]
    );

    const formatWatchTimeSeconds = useCallback(
        (value: number): string => {
            if (!Number.isFinite(value) || value <= 0) {
                return `0 ${t('video.analytics.units.minutesShort')}`;
            }
            if (value >= 3600) {
                return `${(value / 3600).toFixed(1)} ${t('video.analytics.units.hoursShort')}`;
            }
            if (value >= 60) {
                return `${(value / 60).toFixed(1)} ${t('video.analytics.units.minutesShort')}`;
            }
            return `${value.toFixed(0)} ${t('video.analytics.units.secondsShort')}`;
        },
        [t]
    );

    const formatCfa = useCallback(
        (value: number): string => {
            const currencyLabel = t('video.analytics.units.cfa');
            if (!Number.isFinite(value)) {
                return `0 ${currencyLabel}`;
            }

            const locale =
                language === 'fr'
                    ? 'fr-FR'
                    : language === 'en'
                        ? 'en-US'
                        : 'fr-FR';

            return `${Math.round(value).toLocaleString(locale)} ${currencyLabel}`;
        },
        [language, t]
    );

    const fetchAnalytics = useCallback(async () => {
        try {
            if (!silentFetchRef.current) {
                setLoading(true);
            }
            setError(null);
            setLiveError(null);

            const [contentResponse, liveResponse, overviewResponse] = await Promise.all([
                analyticsApi.getContentAnalytics({
                    days: DEFAULT_DAYS,
                    limit: DEFAULT_LIMIT
                }),
                liveStreamingService.getLiveAnalytics(),
                analyticsApi.getVideoOverview({ days: DEFAULT_DAYS })
            ]);

            if (contentResponse.success && contentResponse.data?.success) {
                setData(contentResponse.data.data);
            } else {
                const message =
                    contentResponse.error ||
                    (contentResponse.data && contentResponse.data.success === false
                        ? t('video.analytics.errors.serverNoAnalytics')
                        : t('video.analytics.errors.contentUnavailable'));
                setError(message);
            }

            if (liveResponse.success) {
                const envelope = liveResponse.data;
                if (envelope?.data && Array.isArray(envelope.data)) {
                    setLiveAnalytics(envelope.data);
                } else {
                    setLiveAnalytics([]);
                }
            } else {
                setLiveAnalytics([]);
                setLiveError(
                    liveResponse.error || t('video.analytics.errors.liveUnavailable')
                );
            }

            if (overviewResponse.success) {
                const payload = overviewResponse.data;
                if (isVideoAnalyticsOverviewResponse(payload)) {
                    if (!payload.success) {
                        setVideoOverview(null);
                        setOverviewError(
                            (payload as { error?: string }).error ||
                            t('video.analytics.errors.overviewUnavailable')
                        );
                    } else {
                        setVideoOverview(payload.data);
                        setOverviewError(null);
                    }
                } else if (isVideoAnalyticsOverview(payload)) {
                    setVideoOverview(payload);
                    setOverviewError(null);
                } else if (payload && typeof payload === 'object' && 'error' in payload) {
                    setVideoOverview(null);
                    setOverviewError(
                        (payload as { error?: string }).error ||
                        t('video.analytics.errors.overviewUnavailable')
                    );
                } else {
                    setVideoOverview(null);
                    setOverviewError(t('video.analytics.overview.unexpected'));
                }
            } else {
                setVideoOverview(null);
                setOverviewError(
                    overviewResponse.error || t('video.analytics.errors.overviewUnavailable')
                );
            }
        } catch (err: any) {
            console.error('[VideoAnalytics] fetch error', err);
            const fallback = t('video.analytics.errors.unexpected');
            setError(err?.message || fallback);
            setLiveError(err?.message || fallback);
            setOverviewError(err?.message || t('video.analytics.errors.overviewUnavailable'));
            setVideoOverview(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
            silentFetchRef.current = false;
        }
    }, [t]);

    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            silentFetchRef.current = true;
            fetchAnalytics();
        }

        return () => {
            silentFetchRef.current = false;
        };
    }, [isFocused, fetchAnalytics]);

    const closeMarketingModal = useCallback(() => {
        setMarketingVisible(false);
        setMarketingResult(null);
        setMarketingType(null);
        setMarketingSession(null);
        setMarketingError(null);
        setMarketingLoading(false);
    }, []);

    const handleMarketingAction = useCallback(
        async (
            session: LiveSessionRecord,
            metrics: LiveSessionAnalyticsRecord | null,
            type: 'teaser' | 'invites' | 'followup'
        ) => {
            const metadata = (session.metadata as Record<string, any> | null) ?? {};
            setMarketingSession(session);
            setMarketingType(type);
            setMarketingVisible(true);
            setMarketingLoading(true);
            setMarketingError(null);
            setMarketingResult(null);

            try {
                let response: any;
                if (type === 'teaser') {
                    const payload = {
                        live_title: session.title,
                        product_name: metadata?.product_name ?? metadata?.service_title ?? undefined,
                        product_highlights:
                            Array.isArray(metadata?.product_highlights) ? metadata.product_highlights : [],
                        audience_segment: metadata?.audience_segment ?? metadata?.audience ?? undefined,
                        host_name: metadata?.host_name ?? session.livekit_participant_identity ?? undefined,
                        tone: metadata?.tone ?? undefined,
                        offer: metadata?.offer ?? metadata?.value_proposition ?? undefined,
                        duration_minutes: metadata?.duration_minutes ?? undefined,
                        language: metadata?.language ?? 'fr',
                    };
                    response = await liveMarketingService.generateTeaser(payload);
                } else if (type === 'invites') {
                    const segments = Array.isArray(metadata?.audience_segments)
                        ? metadata.audience_segments
                        : metadata?.audience_segment
                            ? [metadata.audience_segment]
                            : [];
                    const payload = {
                        live_title: session.title,
                        product_name: metadata?.product_name ?? metadata?.service_title ?? undefined,
                        audience_segments: segments,
                        value_proposition:
                            metadata?.value_proposition ??
                            metadata?.offer ??
                            session.description ??
                            undefined,
                        host_name: metadata?.host_name ?? session.livekit_participant_identity ?? undefined,
                        language: metadata?.language ?? 'fr',
                    };
                    response = await liveMarketingService.generateInvites(payload);
                } else {
                    const payload = {
                        live_title: session.title,
                        key_highlights: Array.isArray(metadata?.key_highlights)
                            ? metadata.key_highlights
                            : Array.isArray(metadata?.product_highlights)
                                ? metadata.product_highlights
                                : [],
                        audience_reactions: metadata?.audience_reactions ?? undefined,
                        orders_count:
                            typeof metrics?.conversions === 'number' && metrics.conversions > 0
                                ? metrics.conversions
                                : metadata?.orders_count ?? undefined,
                        next_steps: metadata?.next_steps ?? undefined,
                        language: metadata?.language ?? 'fr',
                    };
                    response = await liveMarketingService.generateFollowup(payload);
                }

                if (response.success && response.data) {
                    setMarketingResult(response.data);
                } else if (response.success === false) {
                    setMarketingError(response.error || t('video.analytics.marketing.error.default'));
                } else {
                    setMarketingResult(response.data ?? null);
                }
            } catch (err: any) {
                console.error('[VideoAnalytics] marketing error', err);
                setMarketingError(err?.message || t('video.analytics.marketing.error.unexpected'));
            } finally {
                setMarketingLoading(false);
            }
        },
        [t]
    );

    const breakdownCards = useMemo(() => data?.breakdown ?? [], [data]);
    const topContent = useMemo(() => data?.top_content ?? [], [data]);
    const marketingTitle = useMemo(() => {
        switch (marketingType) {
            case 'teaser':
                return t('video.analytics.marketing.title.teaser');
            case 'invites':
                return t('video.analytics.marketing.title.invites');
            case 'followup':
                return t('video.analytics.marketing.title.followup');
            default:
                return t('video.analytics.marketing.title.generic');
        }
    }, [marketingType, t]);

    const renderListItems = useCallback((items?: string[]) => {
        if (!items || items.length === 0) {
            return null;
        }
        return items.map((entry, index) => (
            <Text key={`${entry}-${index}`} style={styles.modalBullet}>
                • {entry}
            </Text>
        ));
    }, []);

    const renderTextBlock = useCallback((label: string, value?: string) => {
        if (!value || value.trim().length === 0) {
            return null;
        }
        return (
            <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>{label}</Text>
                <Text style={styles.modalText}>{value.trim()}</Text>
            </View>
        );
    }, []);

    const renderMarketingResult = useCallback(() => {
        if (marketingLoading) {
            return (
                <View style={styles.modalLoading}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.modalLoadingText}>{t('video.analytics.marketing.loading')}</Text>
                </View>
            );
        }

        if (marketingError) {
            return (
                <View style={styles.modalSection}>
                    <Text style={styles.modalError}>{marketingError}</Text>
                </View>
            );
        }

        if (!marketingResult) {
            return (
                <View style={styles.modalSection}>
                    <Text style={styles.modalText}>{t('video.analytics.marketing.ready')}</Text>
                </View>
            );
        }

        if (marketingType === 'teaser') {
            const teaser = marketingResult as {
                hook?: string;
                teaser_script?: string;
                cta?: string;
                hashtags?: string[];
                push_notification?: string;
                email_subject?: string;
                email_body?: string;
                visual_direction?: string;
                talking_points?: string[];
                prep_checklist?: string[];
            };
            return (
                <>
                    {renderTextBlock(t('video.analytics.marketing.labels.hook'), teaser.hook)}
                    {renderTextBlock(t('video.analytics.marketing.labels.teaserScript'), teaser.teaser_script)}
                    {renderTextBlock(t('video.analytics.marketing.labels.cta'), teaser.cta)}
                    {renderTextBlock(t('video.analytics.marketing.labels.pushNotification'), teaser.push_notification)}
                    {renderTextBlock(t('video.analytics.marketing.labels.emailSubject'), teaser.email_subject)}
                    {renderTextBlock(t('video.analytics.marketing.labels.emailBody'), teaser.email_body)}
                    {renderTextBlock(t('video.analytics.marketing.labels.visualDirection'), teaser.visual_direction)}
                    {teaser.hashtags && teaser.hashtags.length > 0 ? (
                        <View style={styles.modalSection}>
                            <Text style={styles.modalLabel}>{t('video.analytics.marketing.labels.hashtags')}</Text>
                            {renderListItems(teaser.hashtags)}
                        </View>
                    ) : null}
                    {teaser.talking_points && teaser.talking_points.length > 0 ? (
                        <View style={styles.modalSection}>
                            <Text style={styles.modalLabel}>{t('video.analytics.marketing.labels.talkingPoints')}</Text>
                            {renderListItems(teaser.talking_points)}
                        </View>
                    ) : null}
                    {teaser.prep_checklist && teaser.prep_checklist.length > 0 ? (
                        <View style={styles.modalSection}>
                            <Text style={styles.modalLabel}>{t('video.analytics.marketing.labels.checklist')}</Text>
                            {renderListItems(teaser.prep_checklist)}
                        </View>
                    ) : null}
                </>
            );
        }

        if (marketingType === 'invites') {
            const invites = marketingResult as {
                push_notification?: string;
                sms_copy?: string;
                email_subject?: string;
                email_body?: string;
                social_post?: string;
                hashtags?: string[];
            };
            return (
                <>
                    {renderTextBlock(t('video.analytics.marketing.labels.pushNotification'), invites.push_notification)}
                    {renderTextBlock(t('video.analytics.marketing.labels.sms'), invites.sms_copy)}
                    {renderTextBlock(t('video.analytics.marketing.labels.emailSubject'), invites.email_subject)}
                    {renderTextBlock(t('video.analytics.marketing.labels.emailBody'), invites.email_body)}
                    {renderTextBlock(t('video.analytics.marketing.labels.socialPost'), invites.social_post)}
                    {invites.hashtags && invites.hashtags.length > 0 ? (
                        <View style={styles.modalSection}>
                            <Text style={styles.modalLabel}>{t('video.analytics.marketing.labels.hashtags')}</Text>
                            {renderListItems(invites.hashtags)}
                        </View>
                    ) : null}
                </>
            );
        }

        const followup = marketingResult as {
            executive_summary?: string;
            highlight_recap?: string[];
            social_post?: string;
            email_followup?: string;
            recommended_actions?: string[];
            product_focus?: string;
        };
        return (
            <>
                {renderTextBlock(t('video.analytics.marketing.labels.executiveSummary'), followup.executive_summary)}
                {followup.highlight_recap && followup.highlight_recap.length > 0 ? (
                    <View style={styles.modalSection}>
                        <Text style={styles.modalLabel}>{t('video.analytics.marketing.labels.moments')}</Text>
                        {renderListItems(followup.highlight_recap)}
                    </View>
                ) : null}
                {renderTextBlock(t('video.analytics.marketing.labels.socialPost'), followup.social_post)}
                {renderTextBlock(t('video.analytics.marketing.labels.followupEmail'), followup.email_followup)}
                {followup.recommended_actions && followup.recommended_actions.length > 0 ? (
                    <View style={styles.modalSection}>
                        <Text style={styles.modalLabel}>{t('video.analytics.marketing.labels.recommendedActions')}</Text>
                        {renderListItems(followup.recommended_actions)}
                    </View>
                ) : null}
                {renderTextBlock(t('video.analytics.marketing.labels.productFocus'), followup.product_focus)}
            </>
        );
    }, [
        marketingError,
        marketingLoading,
        marketingResult,
        marketingType,
        renderListItems,
        renderTextBlock,
        t,
    ]);

    const onRefresh = useCallback(() => {
        silentFetchRef.current = true;
        setRefreshing(true);
        fetchAnalytics();
    }, [fetchAnalytics]);

    const renderVideoOverview = () => {
        if (!videoOverview && !overviewError) {
            return null;
        }

        if (!videoOverview && overviewError) {
            return (
                <View style={styles.overviewErrorContainer}>
                    <Text style={styles.overviewErrorText}>{overviewError}</Text>
                </View>
            );
        }

        if (!videoOverview) {
            return null;
        }

        const distributionTotal =
            videoOverview.distribution_success + videoOverview.distribution_pending;
        const successPercent =
            distributionTotal > 0
                ? Math.round((videoOverview.distribution_success / distributionTotal) * 100)
                : 0;

        return (
            <View style={styles.overviewCard}>
                <View style={styles.overviewHeader}>
                    <Text style={styles.overviewTitle}>{t('video.analytics.overview.title')}</Text>
                    <Text style={styles.overviewSubtitle}>
                        {t('video.analytics.overview.horizon', { days: videoOverview.horizon_days })}
                    </Text>
                </View>
                <View style={styles.overviewGrid}>
                    <View style={styles.overviewMetric}>
                        <Text style={styles.overviewMetricLabel}>
                            {t('video.analytics.overview.generated')}
                        </Text>
                        <Text style={styles.overviewMetricValue}>
                            {formatCount(videoOverview.videos_generated)}
                        </Text>
                    </View>
                    <View style={styles.overviewMetric}>
                        <Text style={styles.overviewMetricLabel}>
                            {t('video.analytics.overview.views')}
                        </Text>
                        <Text style={styles.overviewMetricValue}>
                            {formatCount(videoOverview.total_views)}
                        </Text>
                    </View>
                    <View style={styles.overviewMetric}>
                        <Text style={styles.overviewMetricLabel}>
                            {t('video.analytics.overview.shares')}
                        </Text>
                        <Text style={styles.overviewMetricValue}>
                            {formatCount(videoOverview.total_shares)}
                        </Text>
                    </View>
                </View>
                <View style={styles.overviewQualityRow}>
                    <Text style={styles.overviewQualityLabel}>
                        {t('video.analytics.overview.qualityLabel')}
                    </Text>
                    <Text style={styles.overviewQualityValue}>
                        {videoOverview.average_quality_score.toFixed(1)} / 5
                    </Text>
                </View>
                <View style={styles.overviewDistribution}>
                    <View style={styles.overviewDistributionHeader}>
                        <Text style={styles.overviewDistributionLabel}>
                            {t('video.analytics.overview.distributionLabel')}
                        </Text>
                        <Text style={styles.overviewDistributionValue}>
                            {t('video.analytics.overview.successRate', { percent: successPercent })}
                        </Text>
                    </View>
                    <View style={styles.overviewBarTrack}>
                        <View
                            style={[
                                styles.overviewBarFill,
                                { width: `${successPercent}%` },
                            ]}
                        />
                    </View>
                    <View style={styles.overviewDistributionMeta}>
                        <Text style={styles.overviewDistributionMetaItem}>
                            {t('video.analytics.overview.published', {
                                count: formatCount(videoOverview.distribution_success),
                            })}
                        </Text>
                        <Text style={styles.overviewDistributionMetaItem}>
                            {t('video.analytics.overview.pending', {
                                count: formatCount(videoOverview.distribution_pending),
                            })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderSummary = () => {
        if (!data) {
            return null;
        }

        return (
            <View style={styles.summaryContainer}>
                <View style={styles.summaryCard}>
                    <Text style={styles.cardTitle}>{t('video.analytics.summary.impressions')}</Text>
                    <Text style={styles.cardValue}>{formatCount(data.summary.impressions)}</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.cardTitle}>{t('video.analytics.summary.clicks')}</Text>
                    <Text style={styles.cardValue}>{formatCount(data.summary.clicks)}</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.cardTitle}>{t('video.analytics.summary.ctr')}</Text>
                    <Text style={styles.cardValue}>{formatPercent(data.summary.ctr)}</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.cardTitle}>{t('video.analytics.summary.avgDuration')}</Text>
                    <Text style={styles.cardValue}>{formatDuration(data.summary.avg_view_duration_ms)}</Text>
                </View>
            </View>
        );
    };

    const renderBreakdown = () => {
        if (!breakdownCards.length) {
            return null;
        }

        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('video.analytics.breakdown.title')}</Text>
                <View style={styles.breakdownGrid}>
                    {breakdownCards.map((item) => (
                        <View key={item.content_type} style={styles.breakdownCard}>
                            <Text style={styles.breakdownTitle}>
                                {item.content_type === 'paid'
                                    ? t('video.analytics.breakdown.type.paid')
                                    : t('video.analytics.breakdown.type.organic')}
                            </Text>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>
                                    {t('video.analytics.breakdown.impressions')}
                                </Text>
                                <Text style={styles.breakdownValue}>{formatCount(item.impressions)}</Text>
                            </View>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>
                                    {t('video.analytics.breakdown.ctr')}
                                </Text>
                                <Text style={styles.breakdownValue}>{formatPercent(item.ctr)}</Text>
                            </View>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>
                                    {t('video.analytics.breakdown.avgDuration')}
                                </Text>
                                <Text style={styles.breakdownValue}>{formatDuration(item.avg_view_duration_ms)}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const renderTopContent = () => {
        if (!topContent.length) {
            return null;
        }

        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('video.analytics.top.title')}</Text>
                <View style={styles.topContentList}>
                    {topContent.map((item) => (
                        <View key={item.content_id} style={styles.topContentCard}>
                            <View style={styles.topHeader}>
                                <Text style={styles.topType}>
                                    {item.content_type === 'paid'
                                        ? t('video.analytics.breakdown.type.paid')
                                        : t('video.analytics.breakdown.type.organic')}
                                </Text>
                                {item.last_seen ? (
                                    <Text style={styles.topMeta}>
                                        {t('video.analytics.top.seenAt', {
                                            date: new Date(item.last_seen).toLocaleString(),
                                        })}
                                    </Text>
                                ) : null}
                            </View>
                            <Text style={styles.topId}>{item.content_id}</Text>
                            <View style={styles.metricsRow}>
                                <View style={styles.metricItem}>
                                    <Text style={styles.metricLabel}>
                                        {t('video.analytics.top.labels.impressions')}
                                    </Text>
                                    <Text style={styles.metricValue}>{formatCount(item.impressions)}</Text>
                                </View>
                                <View style={styles.metricItem}>
                                    <Text style={styles.metricLabel}>
                                        {t('video.analytics.top.labels.ctr')}
                                    </Text>
                                    <Text style={styles.metricValue}>{formatPercent(item.ctr)}</Text>
                                </View>
                                <View style={styles.metricItem}>
                                    <Text style={styles.metricLabel}>
                                        {t('video.analytics.top.labels.duration')}
                                    </Text>
                                    <Text style={styles.metricValue}>{formatDuration(item.avg_view_duration_ms)}</Text>
                                </View>
                            </View>
                            <View style={styles.metricsRow}>
                                <View style={styles.metricItem}>
                                    <Text style={styles.metricLabel}>
                                        {t('video.analytics.top.labels.likes')}
                                    </Text>
                                    <Text style={styles.metricValue}>{formatCount(item.likes)}</Text>
                                </View>
                                <View style={styles.metricItem}>
                                    <Text style={styles.metricLabel}>
                                        {t('video.analytics.top.labels.saves')}
                                    </Text>
                                    <Text style={styles.metricValue}>{formatCount(item.saves)}</Text>
                                </View>
                                <View style={styles.metricItem}>
                                    <Text style={styles.metricLabel}>
                                        {t('video.analytics.top.labels.clicks')}
                                    </Text>
                                    <Text style={styles.metricValue}>{formatCount(item.clicks)}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const renderLiveAnalytics = () => {
        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('video.analytics.live.title')}</Text>
                {liveAnalytics.length === 0 ? (
                    <Text style={styles.emptyText}>
                        {t('video.analytics.live.empty')}{' '}
                        {t('video.analytics.live.emptyHint')}
                    </Text>
                ) : (
                    <View style={styles.liveList}>
                        {liveAnalytics.map(({ session, metrics }) => (
                            <View key={session.id} style={styles.liveCard}>
                                <View style={styles.liveHeader}>
                                    <Text style={styles.liveTitle}>{session.title}</Text>
                                    <Text
                                        style={[
                                            styles.liveStatus,
                                            session.status === 'live' ? styles.liveStatusActive : undefined
                                        ]}>
                                        {formatLiveStatus(session.status)}
                                    </Text>
                                </View>
                                <Text style={styles.liveMeta}>
                                    {formatLiveDate(session.start_at)}
                                </Text>
                                <View style={styles.metricsRow}>
                                    <View style={styles.metricItem}>
                                        <Text style={styles.metricLabel}>
                                            {t('video.analytics.live.metrics.audienceTotal')}
                                        </Text>
                                        <Text style={styles.metricValue}>
                                            {formatCount(metrics.total_viewers)}
                                        </Text>
                                    </View>
                                    <View style={styles.metricItem}>
                                        <Text style={styles.metricLabel}>
                                            {t('video.analytics.live.metrics.hls')}
                                        </Text>
                                        <Text style={styles.metricValue}>
                                            {formatCount(metrics.hls_viewers)}
                                        </Text>
                                    </View>
                                    <View style={styles.metricItem}>
                                        <Text style={styles.metricLabel}>
                                            {t('video.analytics.live.metrics.webrtc')}
                                        </Text>
                                        <Text style={styles.metricValue}>
                                            {formatCount(metrics.webrtc_viewers)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.metricsRow}>
                                    <View style={styles.metricItem}>
                                        <Text style={styles.metricLabel}>
                                            {t('video.analytics.live.metrics.totalWatchTime')}
                                        </Text>
                                        <Text style={styles.metricValue}>
                                            {formatWatchTimeSeconds(metrics.total_watch_time_seconds)}
                                        </Text>
                                    </View>
                                    <View style={styles.metricItem}>
                                        <Text style={styles.metricLabel}>
                                            {t('video.analytics.live.metrics.avgWatchTime')}
                                        </Text>
                                        <Text style={styles.metricValue}>
                                            {formatWatchTimeSeconds(metrics.average_watch_time_seconds)}
                                        </Text>
                                    </View>
                                    <View style={styles.metricItem}>
                                        <Text style={styles.metricLabel}>
                                            {t('video.analytics.live.metrics.conversions')}
                                        </Text>
                                        <Text style={styles.metricValue}>
                                            {formatCount(metrics.conversions)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.metricsRow}>
                                    <View style={styles.metricItem}>
                                        <Text style={styles.metricLabel}>
                                            {t('video.analytics.live.metrics.revenue')}
                                        </Text>
                                        <Text style={styles.metricValue}>
                                            {formatCfa(metrics.revenue_cfa)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.marketingRow}>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        style={styles.marketingButton}
                                        onPress={() => handleMarketingAction(session, metrics, 'teaser')}>
                                        <Text style={styles.marketingButtonText}>
                                            {t('video.analytics.marketing.buttons.teaser')}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        style={styles.marketingButton}
                                        onPress={() => handleMarketingAction(session, metrics, 'invites')}>
                                        <Text style={styles.marketingButtonText}>
                                            {t('video.analytics.marketing.buttons.invites')}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        style={styles.marketingButton}
                                        onPress={() => handleMarketingAction(session, metrics, 'followup')}>
                                        <Text style={styles.marketingButtonText}>
                                            {t('video.analytics.marketing.buttons.followup')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeNativeView style={styles.safeArea} edges={['top', 'bottom']}>
            {loading && !refreshing ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.loaderText}>{t('video.analytics.loader')}</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.container}
                    contentContainerStyle={styles.contentContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                    <Text style={styles.title}>{t('video.analytics.title')}</Text>
                    <Text style={styles.subtitle}>
                        {t('video.analytics.subtitle', {
                            days: videoOverview?.horizon_days ?? data?.summary.days ?? DEFAULT_DAYS,
                        })}
                    </Text>

                    {renderVideoOverview()}

                    <View style={styles.segmentedControl}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            style={[
                                styles.segmentButton,
                                activeTab === 'content' ? styles.segmentButtonActive : undefined
                            ]}
                            onPress={() => setActiveTab('content')}>
                            <Text
                                style={[
                                    styles.segmentLabel,
                                    activeTab === 'content' ? styles.segmentLabelActive : undefined
                                ]}>
                                {t('video.analytics.tabs.content')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            accessibilityRole="button"
                            style={[
                                styles.segmentButton,
                                activeTab === 'live' ? styles.segmentButtonActive : undefined
                            ]}
                            onPress={() => setActiveTab('live')}>
                            <Text
                                style={[
                                    styles.segmentLabel,
                                    activeTab === 'live' ? styles.segmentLabelActive : undefined
                                ]}>
                                {t('video.analytics.tabs.live')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {(activeTab === 'content' ? error : liveError) ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>
                                {activeTab === 'content' ? error : liveError}
                            </Text>
                        </View>
                    ) : null}

                    {activeTab === 'content' ? (
                        <>
                            {renderSummary()}
                            {renderBreakdown()}
                            {renderTopContent()}
                        </>
                    ) : (
                        renderLiveAnalytics()
                    )}
                </ScrollView>
            )}
            <Modal
                visible={marketingVisible}
                animationType="slide"
                transparent
                onRequestClose={closeMarketingModal}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>
                            {marketingSession ? marketingTitle : t('video.analytics.marketing.title.generic')}
                        </Text>
                        <ScrollView
                            style={styles.modalScroll}
                            contentContainerStyle={styles.modalScrollContent}>
                            {marketingSession ? (
                                <>
                                    <Text style={styles.modalMeta}>
                                        {marketingSession.title}
                                        {' • '}
                                        {formatLiveDate(marketingSession.start_at)}
                                    </Text>
                                    {renderMarketingResult()}
                                </>
                            ) : (
                                <Text style={styles.modalText}>
                                    {t('video.analytics.marketing.promptSelection')}
                                </Text>
                            )}
                        </ScrollView>
                        <TouchableOpacity
                            accessibilityRole="button"
                            style={styles.modalCloseButton}
                            onPress={closeMarketingModal}>
                            <Text style={styles.modalCloseButtonText}>{t('button.close')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0F172A'
    },
    container: {
        flex: 1,
        backgroundColor: 'transparent'
    },
    contentContainer: {
        paddingBottom: 24,
        paddingHorizontal: 18,
        paddingTop: 16
    },
    title: {
        fontSize: 22,
        fontWeight: '600',
        color: '#F8FAFC',
        marginBottom: 6
    },
    subtitle: {
        fontSize: 14,
        color: '#CBD5F5',
        marginBottom: 18
    },
    overviewErrorContainer: {
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
        borderColor: 'rgba(248, 113, 113, 0.4)',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        padding: 14,
        marginBottom: 18,
    },
    overviewErrorText: {
        color: '#FCA5A5',
        fontSize: 13,
        fontWeight: '500',
    },
    overviewCard: {
        marginBottom: 20,
        backgroundColor: '#111C32',
        borderRadius: 20,
        padding: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(99, 102, 241, 0.25)',
        shadowColor: '#6366F1',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 24,
        elevation: 4,
    },
    overviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    overviewTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#E0E7FF',
    },
    overviewSubtitle: {
        fontSize: 13,
        color: '#A5B4FC',
    },
    overviewGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
    },
    overviewMetric: {
        flex: 1,
        backgroundColor: 'rgba(30, 64, 175, 0.25)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    overviewMetricLabel: {
        fontSize: 12,
        color: '#C7D2FE',
        marginBottom: 4,
    },
    overviewMetricValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#F8FAFC',
    },
    overviewQualityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    overviewQualityLabel: {
        fontSize: 13,
        color: '#CBD5F5',
    },
    overviewQualityValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#38BDF8',
    },
    overviewDistribution: {
        gap: 8,
    },
    overviewDistributionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    overviewDistributionLabel: {
        fontSize: 13,
        color: '#CBD5F5',
    },
    overviewDistributionValue: {
        fontSize: 13,
        color: '#34D399',
        fontWeight: '600',
    },
    overviewBarTrack: {
        height: 10,
        borderRadius: 999,
        backgroundColor: 'rgba(148, 163, 184, 0.25)',
        overflow: 'hidden',
    },
    overviewBarFill: {
        height: '100%',
        backgroundColor: '#34D399',
        borderRadius: 999,
    },
    overviewDistributionMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    overviewDistributionMetaItem: {
        fontSize: 12,
        color: '#CBD5F5',
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        borderRadius: 16,
        padding: 4,
        marginBottom: 16
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center'
    },
    segmentButtonActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.25)'
    },
    segmentLabel: {
        fontSize: 14,
        color: '#CBD5F5'
    },
    segmentLabelActive: {
        fontWeight: '600',
        color: '#E0E7FF'
    },
    loaderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F172A'
    },
    loaderText: {
        marginTop: 12,
        color: '#E2E8F0'
    },
    summaryContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20
    },
    summaryCard: {
        flexBasis: '48%',
        backgroundColor: '#1E293B',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14
    },
    cardTitle: {
        fontSize: 13,
        color: '#94A3B8',
        marginBottom: 6
    },
    cardValue: {
        fontSize: 20,
        fontWeight: '600',
        color: '#F8FAFC'
    },
    section: {
        marginBottom: 24,
        backgroundColor: '#111C32',
        borderRadius: 18,
        padding: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148, 163, 184, 0.2)'
    },
    emptyText: {
        fontSize: 13,
        color: '#94A3B8'
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#E2E8F0',
        marginBottom: 12
    },
    breakdownGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    breakdownCard: {
        flexBasis: '48%',
        backgroundColor: 'rgba(30, 58, 138, 0.25)',
        borderRadius: 16,
        padding: 14
    },
    breakdownTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#BFDBFE',
        marginBottom: 10
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6
    },
    breakdownLabel: {
        fontSize: 12,
        color: '#94A3B8'
    },
    breakdownValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#F8FAFC'
    },
    topContentList: {
        gap: 14
    },
    topContentCard: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148, 163, 184, 0.15)'
    },
    marketingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 12
    },
    marketingButton: {
        flex: 1,
        backgroundColor: '#3730A3',
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(129, 140, 248, 0.6)'
    },
    marketingButtonText: {
        color: '#E0E7FF',
        fontSize: 13,
        fontWeight: '600'
    },
    liveList: {
        gap: 14
    },
    liveCard: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(99, 102, 241, 0.2)'
    },
    liveHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    liveTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F8FAFC',
        flex: 1,
        paddingRight: 12
    },
    liveStatus: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FBBF24',
        textTransform: 'uppercase'
    },
    liveStatusActive: {
        color: '#34D399'
    },
    liveMeta: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 12
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    topType: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FACC15'
    },
    topMeta: {
        fontSize: 12,
        color: '#CBD5F5'
    },
    topId: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 10
    },
    metricsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    metricItem: {
        flex: 1
    },
    metricLabel: {
        fontSize: 11,
        color: '#94A3B8',
        marginBottom: 2
    },
    metricValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F8FAFC'
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16
    },
    modalCard: {
        width: '100%',
        maxHeight: '85%',
        backgroundColor: '#0F172A',
        borderRadius: 20,
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148, 163, 184, 0.3)'
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#F8FAFC',
        marginBottom: 6
    },
    modalMeta: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 12
    },
    modalScroll: {
        flexGrow: 0
    },
    modalScrollContent: {
        paddingBottom: 12
    },
    modalSection: {
        marginBottom: 12
    },
    modalLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#CBD5F5',
        marginBottom: 4
    },
    modalText: {
        fontSize: 13,
        color: '#E2E8F0',
        lineHeight: 19
    },
    modalBullet: {
        fontSize: 13,
        color: '#E2E8F0',
        marginLeft: 4,
        marginBottom: 2,
        lineHeight: 19
    },
    modalCloseButton: {
        marginTop: 8,
        backgroundColor: '#312E81',
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center'
    },
    modalCloseButtonText: {
        color: '#E0E7FF',
        fontSize: 14,
        fontWeight: '600'
    },
    modalError: {
        color: '#FCA5A5',
        fontSize: 13
    },
    modalLoading: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24
    },
    modalLoadingText: {
        marginTop: 12,
        color: '#CBD5F5'
    },
    errorContainer: {
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16
    },
    errorText: {
        color: '#FCA5A5',
        fontSize: 13
    }
});

export default VideoAnalyticsScreen;
