import axios from 'axios';
import React, { useEffect, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { buildUrl } from '../config/api.config';

interface TimeSeriesData {
    date: string;
    vues: number;
    clics: number;
    conversions: number;
    budget: number;
    impressions: number;
}

interface CampaignComparison {
    campaign_id: number;
    titre: string;
    vues: number;
    clics: number;
    conversion_rate: number;
    budget: number;
    roi: number;
}

interface ConversionFunnel {
    impressions: number;
    views: number;
    clicks: number;
    conversions: number;
    drop_off_rates: Array<{
        step: string;
        count: number;
        drop_off_pct: number;
    }>;
}

interface PlacementPerformance {
    placement: string;
    vues: number;
    clics: number;
    conversion_rate: number;
    ctr: number;
}

interface AdvancedAnalyticsData {
    time_series: TimeSeriesData[];
    campaign_comparison: CampaignComparison[];
    conversion_funnel: ConversionFunnel;
    performance_by_placement: PlacementPerformance[];
    performance_by_targeting: Array<{
        targeting_type: string;
        count: number;
        avg_conversion: number;
        avg_ctr: number;
    }>;
}

interface AdvancedAnalyticsChartProps {
    userId: number;
    periodDays?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AdvancedAnalyticsChart: React.FC<AdvancedAnalyticsChartProps> = ({
    userId,
    periodDays = 30,
}) => {
    const [data, setData] = useState<AdvancedAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'time' | 'campaigns' | 'funnel' | 'placement' | 'targeting'>('time');

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                setLoading(true);
                const response = await axios.get<AdvancedAnalyticsData>(
                    buildUrl(`/api/publicites/analytics/advanced?user_id=${userId}&period_days=${periodDays}`)
                );
                setData(response.data);
                setError(null);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Erreur lors du chargement des analytics');
                console.error('Erreur analytics:', err);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchAnalytics();
        }
    }, [userId, periodDays]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement des analytics...</p>
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

    if (!data) {
        return (
            <div className="text-center p-8 text-gray-500">
                Aucune donnée disponible
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex space-x-2 border-b">
                {[
                    { key: 'time', label: '📈 Tendances', icon: '📈' },
                    { key: 'campaigns', label: '📊 Campagnes', icon: '📊' },
                    { key: 'funnel', label: '🔄 Funnel', icon: '🔄' },
                    { key: 'placement', label: '📍 Placements', icon: '📍' },
                    { key: 'targeting', label: '🎯 Ciblage', icon: '🎯' },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`px-4 py-2 font-medium transition-colors ${activeTab === tab.key
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Time Series Chart */}
            {activeTab === 'time' && data.time_series.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-bold mb-4">📈 Tendances Temporelles</h3>
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={data.time_series}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip />
                            <Legend />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="vues"
                                stroke="#0088FE"
                                name="Vues"
                                strokeWidth={2}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="clics"
                                stroke="#00C49F"
                                name="Clics"
                                strokeWidth={2}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="conversions"
                                stroke="#FF8042"
                                name="Taux Conversion (%)"
                                strokeWidth={2}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="budget"
                                stroke="#8884d8"
                                name="Budget"
                                strokeWidth={2}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Campaign Comparison */}
            {activeTab === 'campaigns' && data.campaign_comparison.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-bold mb-4">📊 Comparaison des Campagnes</h3>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={data.campaign_comparison}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="titre" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="vues" fill="#0088FE" name="Vues" />
                            <Bar dataKey="clics" fill="#00C49F" name="Clics" />
                            <Bar dataKey="conversion_rate" fill="#FF8042" name="Taux Conversion (%)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Conversion Funnel */}
            {activeTab === 'funnel' && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-bold mb-4">🔄 Funnel de Conversion</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-semibold mb-4">Étapes du Funnel</h4>
                            <div className="space-y-4">
                                {[
                                    { label: 'Impressions', value: data.conversion_funnel.impressions, color: '#0088FE' },
                                    { label: 'Vues', value: data.conversion_funnel.views, color: '#00C49F' },
                                    { label: 'Clics', value: data.conversion_funnel.clicks, color: '#FFBB28' },
                                    { label: 'Conversions', value: data.conversion_funnel.conversions, color: '#FF8042' },
                                ].map((step, index) => {
                                    const maxValue = data.conversion_funnel.impressions;
                                    const percentage = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
                                    return (
                                        <div key={index} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium">{step.label}</span>
                                                <span className="text-gray-600">{step.value.toLocaleString()}</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-4">
                                                <div
                                                    className="h-4 rounded-full transition-all"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        backgroundColor: step.color,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Taux d'Abandon</h4>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={data.conversion_funnel.drop_off_rates}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="step" angle={-45} textAnchor="end" height={100} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="drop_off_pct" fill="#FF8042" name="Taux d'abandon (%)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Placement Performance */}
            {activeTab === 'placement' && data.performance_by_placement.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-bold mb-4">📍 Performance par Placement</h3>
                    <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                            <Pie
                                data={data.performance_by_placement}
                                dataKey="vues"
                                nameKey="placement"
                                cx="50%"
                                cy="50%"
                                outerRadius={120}
                                label
                            >
                                {data.performance_by_placement.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {data.performance_by_placement.map((placement, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold">{placement.placement}</h4>
                                <p className="text-sm text-gray-600">Vues: {placement.vues.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">Clics: {placement.clics.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">
                                    CTR: {placement.ctr.toFixed(2)}%
                                </p>
                                <p className="text-sm text-gray-600">
                                    Conversion: {placement.conversion_rate.toFixed(2)}%
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Targeting Performance */}
            {activeTab === 'targeting' && data.performance_by_targeting.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-bold mb-4">🎯 Performance par Type de Ciblage</h3>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={data.performance_by_targeting}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="targeting_type" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="avg_conversion" fill="#0088FE" name="Conversion Moyenne (%)" />
                            <Bar dataKey="avg_ctr" fill="#00C49F" name="CTR Moyen (%)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default AdvancedAnalyticsChart;

