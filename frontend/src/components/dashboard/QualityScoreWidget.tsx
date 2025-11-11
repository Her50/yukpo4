import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Star } from 'lucide-react';
import React, { useMemo } from 'react';

export interface QualityScoreItem {
    mediaId: number;
    serviceId: number;
    qualityScore: number;
    occurredAt: string;
}

interface QualityScoreWidgetProps {
    average: number;
    items: QualityScoreItem[];
    className?: string;
}

const formatDateTime = (value: string) => {
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(value));
    } catch {
        return value;
    }
};

const buildSparklinePath = (values: number[]): string => {
    if (values.length === 0) {
        return '';
    }
    const width = 200;
    const height = 56;
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 100);
    const range = max - min || 1;
    const step = width / Math.max(values.length - 1, 1);

    return values
        .map((value, index) => {
            const x = index * step;
            const normalized = (value - min) / range;
            const y = height - normalized * height;
            return `${index === 0 ? 'M' : 'L'}${x},${y}`;
        })
        .join(' ');
};

export const QualityScoreWidget: React.FC<QualityScoreWidgetProps> = ({
    average,
    items,
    className,
}) => {
    const stats = useMemo(() => {
        if (items.length === 0) {
            return {
                latest: [],
                sparkline: '',
                max: 0,
                min: 0,
            };
        }
        const sorted = [...items].sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );
        const history = sorted.slice(0, 12).reverse();
        const sparkline = buildSparklinePath(history.map((item) => item.qualityScore));
        const max = Math.max(...history.map((item) => item.qualityScore));
        const min = Math.min(...history.map((item) => item.qualityScore));

        return {
            latest: sorted.slice(0, 5),
            sparkline,
            max,
            min,
        };
    }, [items]);

    const badgeLabel =
        average >= 80 ? 'Excellent' : average >= 60 ? 'Bon' : 'À optimiser';

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Qualité moyenne des vidéos générées
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-1">Score global</p>
                        <div className="flex items-baseline gap-3">
                            <p className="text-4xl font-bold text-gray-900">
                                {average.toFixed(1)}
                            </p>
                            <Badge className="bg-indigo-100 text-indigo-700">{badgeLabel}</Badge>
                        </div>
                        <div className="mt-6">
                            {stats.sparkline ? (
                                <svg
                                    viewBox="0 0 200 56"
                                    className="w-full h-14 text-indigo-500"
                                    preserveAspectRatio="xMidYMid meet"
                                >
                                    <path
                                        d={stats.sparkline}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            ) : (
                                <div className="h-14 flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
                                    <BarChart3 className="w-8 h-8" />
                                </div>
                            )}
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>Min {stats.min.toFixed(1)}</span>
                                <span>Max {stats.max.toFixed(1)}</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-4 max-w-md">
                            Le score qualité tient compte des voix off, sous-titres, variantes et effets
                            appliqués. Utilisez-le pour prioriser vos améliorations.
                        </p>
                    </div>
                    <div className="flex-1">
                        {stats.latest.length === 0 ? (
                            <div className="text-center text-gray-500 py-6">
                                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>Pas encore de vidéos notées</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {stats.latest.map((item) => (
                                    <div
                                        key={`${item.mediaId}-${item.occurredAt}`}
                                        className="flex items-center justify-between border border-gray-200 rounded-lg p-3"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">Vidéo #{item.mediaId}</p>
                                            <p className="text-xs text-gray-500">
                                                Service #{item.serviceId} • {formatDateTime(item.occurredAt)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-gray-900">
                                                {item.qualityScore.toFixed(1)}
                                            </p>
                                            <p className="text-xs text-gray-500">sur 100</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default QualityScoreWidget;


