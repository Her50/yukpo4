import { Badge } from '@/components/ui/badge';
import axios from 'axios';
import { AlertCircle, CheckCircle, TrendingUp, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { buildUrl } from '../config/api.config';
import { Button } from './ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

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
                    buildUrl(`/api/publicites/optimization/suggestions?user_id=${userId}`)
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
            <div className="flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Analyse en cours...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">❌ {error}</p>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="text-center p-8 text-gray-500">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-semibold">Toutes vos campagnes sont optimisées !</p>
                <p className="text-sm mt-2">Aucune suggestion d'amélioration pour le moment.</p>
            </div>
        );
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'bg-red-100 text-red-800 border-red-300';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'low':
                return 'bg-blue-100 text-blue-800 border-blue-300';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'high':
                return 'bg-red-500';
            case 'medium':
                return 'bg-yellow-500';
            case 'low':
                return 'bg-green-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-green-600';
        if (score >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-6">
                <Zap className="w-6 h-6 text-yellow-500" />
                <h2 className="text-2xl font-bold">Suggestions d'Optimisation</h2>
                <Badge variant="outline" className="ml-auto">
                    {reports.length} campagne{reports.length > 1 ? 's' : ''}
                </Badge>
            </div>

            {reports.map((report) => (
                <Card key={report.campaign_id} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <CardTitle className="text-lg mb-2">{report.campaign_title}</CardTitle>
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Score:</span>
                                        <span className={`text-lg font-bold ${getScoreColor(report.overall_score)}`}>
                                            {report.overall_score.toFixed(1)}/100
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Risque:</span>
                                        <div className={`w-3 h-3 rounded-full ${getRiskColor(report.risk_level)}`}></div>
                                        <span className="text-sm capitalize">{report.risk_level}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-600 capitalize">{report.performance_trend}</span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedCampaign(
                                    expandedCampaign === report.campaign_id ? null : report.campaign_id
                                )}
                            >
                                {expandedCampaign === report.campaign_id ? 'Masquer' : 'Voir suggestions'}
                            </Button>
                        </div>
                    </CardHeader>

                    {expandedCampaign === report.campaign_id && report.suggestions.length > 0 && (
                        <CardContent>
                            <div className="space-y-4">
                                {report.suggestions.map((suggestion, index) => (
                                    <div
                                        key={index}
                                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge className={getPriorityColor(suggestion.priority)}>
                                                    {suggestion.priority === 'high' && <AlertCircle className="w-3 h-3 mr-1" />}
                                                    {suggestion.priority}
                                                </Badge>
                                                <span className="text-xs text-gray-500">
                                                    {suggestion.suggestion_type}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-green-600">
                                                    +{suggestion.expected_improvement.toFixed(0)}% attendu
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    Confiance: {(suggestion.confidence * 100).toFixed(0)}%
                                                </div>
                                            </div>
                                        </div>
                                        <h4 className="font-semibold text-gray-900 mb-1">{suggestion.title}</h4>
                                        <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    // TODO: Implémenter l'application de la suggestion
                                                    alert('Fonctionnalité à venir: Application automatique de la suggestion');
                                                }}
                                            >
                                                Appliquer
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    // TODO: Implémenter l'ignorer
                                                    alert('Suggestion ignorée');
                                                }}
                                            >
                                                Ignorer
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    )}

                    {expandedCampaign === report.campaign_id && report.suggestions.length === 0 && (
                        <CardContent>
                            <div className="text-center py-4 text-gray-500">
                                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                <p>Aucune suggestion pour cette campagne</p>
                            </div>
                        </CardContent>
                    )}
                </Card>
            ))}
        </div>
    );
};

export default OptimizationSuggestions;

