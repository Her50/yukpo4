import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { modernColors } from '../styles/theme';
import { NativeButton, NativeCard } from './NativeDesign';
import { SafeIcon } from './SafeIcon';

interface OptimizationSuggestion {
    suggestion_type: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    current_value: any;
    suggested_value: any;
    expected_improvement: number;
    confidence: number;
}

interface OptimizationReport {
    campaign_id: number;
    campaign_title: string;
    suggestions: OptimizationSuggestion[];
    overall_score: number;
    performance_trend: string;
    risk_level: 'low' | 'medium' | 'high';
}

interface OptimizationSuggestionsProps {
    userId: number;
}

const OptimizationSuggestions: React.FC<OptimizationSuggestionsProps> = ({ userId }) => {
    const [reports, setReports] = useState<OptimizationReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedCampaign, setExpandedCampaign] = useState<number | null>(null);

    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                setLoading(true);
                const response = await axios.get<{ reports: OptimizationReport[] }>(
                    `${API_BASE_URL}/api/publicites/optimization/suggestions?user_id=${userId}`
                );
                setReports(response.data.reports);
                setError(null);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Erreur lors du chargement des suggestions');
                console.error('Erreur suggestions:', err);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchSuggestions();
        }
    }, [userId]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Analyse en cours...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <NativeCard style={styles.errorCard}>
                <Text style={styles.errorText}>❌ {error}</Text>
            </NativeCard>
        );
    }

    if (reports.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <SafeIcon name="check-circle" size={64} color="#10B981" />
                <Text style={styles.emptyTitle}>Toutes vos campagnes sont optimisées !</Text>
                <Text style={styles.emptyText}>Aucune suggestion d'amélioration pour le moment.</Text>
            </View>
        );
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return '#EF4444';
            case 'medium':
                return '#F59E0B';
            case 'low':
                return '#3B82F6';
            default:
                return '#6B7280';
        }
    };

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'high':
                return '#EF4444';
            case 'medium':
                return '#F59E0B';
            case 'low':
                return '#10B981';
            default:
                return '#6B7280';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return '#10B981';
        if (score >= 40) return '#F59E0B';
        return '#EF4444';
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="zap" size={24} color="#F59E0B" />
                <Text style={styles.headerTitle}>Suggestions d'Optimisation</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{reports.length}</Text>
                </View>
            </View>

            {reports.map((report) => (
                <NativeCard key={report.campaign_id} style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                        <View style={styles.reportTitleRow}>
                            <Text style={styles.reportTitle} numberOfLines={2}>
                                {report.campaign_title}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setExpandedCampaign(
                                    expandedCampaign === report.campaign_id ? null : report.campaign_id
                                )}
                                style={styles.expandButton}
                            >
                                <SafeIcon
                                    name={expandedCampaign === report.campaign_id ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color={modernColors.primary}
                                />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.metricsRow}>
                            <View style={styles.metric}>
                                <Text style={styles.metricLabel}>Score</Text>
                                <Text style={[styles.metricValue, { color: getScoreColor(report.overall_score) }]}>
                                    {report.overall_score.toFixed(1)}
                                </Text>
                            </View>
                            <View style={styles.metric}>
                                <Text style={styles.metricLabel}>Risque</Text>
                                <View style={[styles.riskDot, { backgroundColor: getRiskColor(report.risk_level) }]} />
                                <Text style={styles.metricValueSmall} numberOfLines={1}>
                                    {report.risk_level}
                                </Text>
                            </View>
                            <View style={styles.metric}>
                                <Text style={styles.metricLabel}>Tendance</Text>
                                <SafeIcon name="trending-up" size={16} color={modernColors.textSecondary} />
                                <Text style={styles.metricValueSmall} numberOfLines={1}>
                                    {report.performance_trend}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {expandedCampaign === report.campaign_id && report.suggestions.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                            {report.suggestions.map((suggestion, index) => (
                                <View key={index} style={styles.suggestionCard}>
                                    <View style={styles.suggestionHeader}>
                                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(suggestion.priority) }]}>
                                            <Text style={styles.priorityText}>{suggestion.priority}</Text>
                                        </View>
                                        <Text style={styles.suggestionType}>{suggestion.suggestion_type}</Text>
                                    </View>
                                    <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                                    <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                                    <View style={styles.suggestionFooter}>
                                        <View style={styles.improvementBadge}>
                                            <Text style={styles.improvementText}>
                                                +{suggestion.expected_improvement.toFixed(0)}% attendu
                                            </Text>
                                        </View>
                                        <Text style={styles.confidenceText}>
                                            Confiance: {(suggestion.confidence * 100).toFixed(0)}%
                                        </Text>
                                    </View>
                                    <View style={styles.actionButtons}>
                                        <NativeButton
                                            title="Appliquer"
                                            variant="primary"
                                            size="small"
                                            onPress={() => {
                                                // TODO: Implémenter l'application
                                                alert('Fonctionnalité à venir');
                                            }}
                                        />
                                        <NativeButton
                                            title="Ignorer"
                                            variant="outline"
                                            size="small"
                                            onPress={() => {
                                                // TODO: Implémenter l'ignorer
                                                alert('Suggestion ignorée');
                                            }}
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {expandedCampaign === report.campaign_id && report.suggestions.length === 0 && (
                        <View style={styles.noSuggestions}>
                            <SafeIcon name="check-circle" size={32} color="#10B981" />
                            <Text style={styles.noSuggestionsText}>Aucune suggestion pour cette campagne</Text>
                        </View>
                    )}
                </NativeCard>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: modernColors.textSecondary,
    },
    errorCard: {
        padding: 16,
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
    },
    errorText: {
        color: '#DC2626',
        textAlign: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.textPrimary,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.textPrimary,
        flex: 1,
    },
    badge: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    reportCard: {
        marginBottom: 16,
        padding: 16,
    },
    reportHeader: {
        marginBottom: 12,
    },
    reportTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    reportTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.textPrimary,
        flex: 1,
    },
    expandButton: {
        padding: 4,
    },
    metricsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    metric: {
        alignItems: 'center',
        gap: 4,
    },
    metricLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    metricValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    metricValueSmall: {
        fontSize: 12,
        color: modernColors.textPrimary,
        textTransform: 'capitalize',
    },
    riskDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    suggestionsContainer: {
        marginTop: 12,
        gap: 12,
    },
    suggestionCard: {
        padding: 12,
        backgroundColor: modernColors.backgroundSecondary,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: modernColors.primary,
    },
    suggestionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    priorityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    priorityText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    suggestionType: {
        fontSize: 11,
        color: modernColors.textSecondary,
        textTransform: 'capitalize',
    },
    suggestionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textPrimary,
        marginBottom: 4,
    },
    suggestionDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 18,
    },
    suggestionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    improvementBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    improvementText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    confidenceText: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    noSuggestions: {
        padding: 20,
        alignItems: 'center',
    },
    noSuggestionsText: {
        marginTop: 8,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
});

export default OptimizationSuggestions;

