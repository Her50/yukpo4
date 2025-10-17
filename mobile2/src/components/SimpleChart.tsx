import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

interface ChartData {
    label: string;
    value: number;
    color?: string;
}

interface SimpleChartProps {
    data: ChartData[];
    title: string;
    type: 'bar' | 'line' | 'pie';
    height?: number;
}

const { width } = Dimensions.get('window');

const SimpleChart: React.FC<SimpleChartProps> = ({
    data,
    title,
    type,
    height = 200
}) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const totalValue = data.reduce((sum, d) => sum + d.value, 0);

    const renderBarChart = () => {
        return (
            <View style={styles.chartContainer}>
                {data.map((item, index) => {
                    const barHeight = maxValue > 0 ? (item.value / maxValue) * (height - 60) : 0;
                    return (
                        <View key={index} style={styles.barItem}>
                            <View style={styles.barContainer}>
                                <View
                                    style={[
                                        styles.bar,
                                        {
                                            height: barHeight,
                                            backgroundColor: item.color || theme.colors.primary,
                                        }
                                    ]}
                                />
                            </View>
                            <Text style={styles.barLabel} numberOfLines={1}>
                                {item.label}
                            </Text>
                            <Text style={styles.barValue}>
                                {item.value.toLocaleString('fr-FR')}
                            </Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderLineChart = () => {
        const chartWidth = width - 80;
        const chartHeight = height - 60;
        const stepX = chartWidth / (data.length - 1);

        return (
            <View style={styles.chartContainer}>
                <View style={[styles.lineChartContainer, { height: chartHeight }]}>
                    {/* Grille horizontale */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
                        <View
                            key={index}
                            style={[
                                styles.gridLine,
                                {
                                    top: ratio * chartHeight,
                                    opacity: 0.3
                                }
                            ]}
                        />
                    ))}

                    {/* Ligne de données */}
                    <View style={styles.lineContainer}>
                        {data.map((item, index) => {
                            const x = index * stepX;
                            const y = maxValue > 0 ? chartHeight - (item.value / maxValue) * chartHeight : chartHeight;

                            return (
                                <View key={index}>
                                    <View
                                        style={[
                                            styles.linePoint,
                                            {
                                                left: x - 4,
                                                top: y - 4,
                                                backgroundColor: item.color || theme.colors.primary,
                                            }
                                        ]}
                                    />
                                    {index < data.length - 1 && (
                                        <View
                                            style={[
                                                styles.lineSegment,
                                                {
                                                    left: x,
                                                    top: y,
                                                    width: stepX,
                                                    height: 2,
                                                    backgroundColor: item.color || theme.colors.primary,
                                                    transform: [{
                                                        rotate: `${Math.atan2(
                                                            (maxValue > 0 ? chartHeight - (data[index + 1].value / maxValue) * chartHeight : chartHeight) - y,
                                                            stepX
                                                        )}rad`
                                                    }]
                                                }
                                            ]}
                                        />
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Labels */}
                <View style={styles.lineLabels}>
                    {data.map((item, index) => (
                        <Text key={index} style={styles.lineLabel} numberOfLines={1}>
                            {item.label}
                        </Text>
                    ))}
                </View>
            </View>
        );
    };

    const renderPieChart = () => {
        let currentAngle = 0;
        const radius = Math.min(width - 120, height - 100) / 2;
        const centerX = (width - 40) / 2;
        const centerY = height / 2;

        return (
            <View style={styles.chartContainer}>
                <View style={[styles.pieContainer, { height }]}>
                    {data.map((item, index) => {
                        const percentage = totalValue > 0 ? item.value / totalValue : 0;
                        const angle = percentage * 360;
                        const startAngle = currentAngle;
                        const endAngle = currentAngle + angle;
                        currentAngle += angle;

                        // Calcul des coordonnées pour l'arc
                        const startX = centerX + radius * Math.cos((startAngle - 90) * Math.PI / 180);
                        const startY = centerY + radius * Math.sin((startAngle - 90) * Math.PI / 180);
                        const endX = centerX + radius * Math.cos((endAngle - 90) * Math.PI / 180);
                        const endY = centerY + radius * Math.sin((endAngle - 90) * Math.PI / 180);

                        const largeArcFlag = angle > 180 ? 1 : 0;

                        return (
                            <View key={index} style={styles.pieItem}>
                                <View
                                    style={[
                                        styles.pieLegend,
                                        { backgroundColor: item.color || theme.colors.primary }
                                    ]}
                                />
                                <Text style={styles.pieLabel}>
                                    {item.label}: {item.value.toLocaleString('fr-FR')} ({Math.round(percentage * 100)}%)
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderChart = () => {
        switch (type) {
            case 'bar':
                return renderBarChart();
            case 'line':
                return renderLineChart();
            case 'pie':
                return renderPieChart();
            default:
                return renderBarChart();
        }
    };

    return (
        <View style={[styles.container, { height: height + 40 }]}>
            <Text style={styles.title}>{title}</Text>
            {renderChart()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    chartContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Bar Chart Styles
    barItem: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 8,
        width: '100%',
    },
    barContainer: {
        height: 120,
        width: 40,
        justifyContent: 'flex-end',
        marginRight: 8,
    },
    bar: {
        width: '100%',
        borderRadius: 4,
        minHeight: 2,
    },
    barLabel: {
        flex: 1,
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    barValue: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text,
        marginLeft: 8,
    },

    // Line Chart Styles
    lineChartContainer: {
        width: '100%',
        position: 'relative',
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        borderColor: theme.colors.border,
    },
    gridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    lineContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    linePoint: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    lineSegment: {
        position: 'absolute',
    },
    lineLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 8,
    },
    lineLabel: {
        fontSize: 10,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        flex: 1,
    },

    // Pie Chart Styles
    pieContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    pieItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        width: '100%',
    },
    pieLegend: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    pieLabel: {
        fontSize: 12,
        color: theme.colors.text,
        flex: 1,
    },
});

export default SimpleChart;


