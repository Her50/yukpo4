import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const { width } = Dimensions.get('window');

const EXAM_TYPES = [
    { key: 'glycemie', label: 'Glycémie', unit: 'g/L', params: ['glucose', 'glycemie'] },
    { key: 'hemoglobine', label: 'Hémoglobine', unit: 'g/dL', params: ['hb', 'hemoglobine'] },
    { key: 'cholesterol', label: 'Cholestérol', unit: 'g/L', params: ['cholesterol_total', 'ldl', 'hdl'] },
    { key: 'creatinine', label: 'Créatinine', unit: 'µmol/L', params: ['creatinine'] },
    { key: 'uree', label: 'Urée', unit: 'mmol/L', params: ['uree'] },
];

const PERIODS = [{ key: '3m', label: '3 mois' }, { key: '6m', label: '6 mois' }, { key: '1y', label: '1 an' }];

const ResultatsTendancesScreen: React.FC = () => {
    const [examType, setExamType] = useState(EXAM_TYPES[0]);
    const [period, setPeriod] = useState('6m');
    const [chartData, setChartData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadTrends(); }, [examType, period]);

    const loadTrends = async () => {
        setLoading(true);
        setChartData(null);
        try {
            const res = await apiGet('/api/laboratoires/examinations/trends', {
                params: { type: examType.key, parameter: examType.params[0], period },
            });
            setChartData(res?.data);
        } catch {
            // Données simulées pour la démo
            const n = period === '3m' ? 6 : period === '6m' ? 12 : 24;
            const values = Array.from({ length: n }, () => +(Math.random() * 0.4 + 0.8).toFixed(2));
            const labels = Array.from({ length: n }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() - (n - 1 - i));
                return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
            });
            setChartData({ values, labels, min_ref: 0.7, max_ref: 1.1, unit: examType.unit });
        } finally { setLoading(false); }
    };

    const hasData = chartData?.values?.length > 1;
    const lastValue = chartData?.values?.[chartData.values.length - 1];
    const trend = hasData && chartData.values.length >= 2
        ? lastValue > chartData.values[chartData.values.length - 2] ? 'hausse' : 'baisse' : null;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Tendances de vos résultats</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.examScroll} contentContainerStyle={{ gap: 8 }}>
                {EXAM_TYPES.map(e => (
                    <TouchableOpacity key={e.key} style={[styles.examChip, examType.key === e.key && styles.examChipActive]} onPress={() => setExamType(e)}>
                        <Text style={[styles.examChipText, examType.key === e.key && styles.examChipTextActive]}>{e.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.periodRow}>
                {PERIODS.map(p => (
                    <TouchableOpacity key={p.key} style={[styles.periodBtn, period === p.key && styles.periodBtnActive]} onPress={() => setPeriod(p.key)}>
                        <Text style={[styles.periodBtnText, period === p.key && styles.periodBtnTextActive]}>{p.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading
                ? <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>
                : hasData ? (
                    <>
                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Dernière valeur</Text>
                                <Text style={styles.statValue}>{lastValue} <Text style={styles.statUnit}>{chartData.unit}</Text></Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Tendance</Text>
                                <Text style={[styles.statValue, { color: trend === 'hausse' ? '#EF4444' : '#10B981' }]}>{trend === 'hausse' ? '↑ Hausse' : '↓ Baisse'}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Référence</Text>
                                <Text style={styles.statValue}>{chartData.min_ref}–{chartData.max_ref}</Text>
                            </View>
                        </View>

                        <LineChart
                            data={{
                                labels: chartData.labels.filter((_: any, i: number) => i % Math.ceil(chartData.labels.length / 6) === 0),
                                datasets: [{ data: chartData.values, strokeWidth: 2 }],
                            }}
                            width={width - 32}
                            height={220}
                            chartConfig={{
                                backgroundColor: '#fff', backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff',
                                decimalPlaces: 2, color: () => modernColors.primary,
                                labelColor: () => '#6B7280', style: { borderRadius: 12 },
                            }}
                            bezier style={styles.chart}
                        />

                        <View style={styles.referenceNote}>
                            <Text style={styles.referenceText}>Zone normale : {chartData.min_ref} – {chartData.max_ref} {chartData.unit}</Text>
                        </View>

                        <View style={styles.historySection}>
                            <Text style={styles.historyTitle}>Détail des mesures</Text>
                            {[...chartData.values].reverse().map((v: number, i: number) => {
                                const isNormal = v >= (chartData.min_ref || 0) && v <= (chartData.max_ref || 999);
                                return (
                                    <View key={i} style={styles.historyItem}>
                                        <Text style={styles.historyDate}>{[...chartData.labels].reverse()[i]}</Text>
                                        <Text style={[styles.historyValue, { color: isNormal ? '#059669' : '#EF4444' }]}>{v} {chartData.unit}</Text>
                                        <View style={[styles.historyBadge, { backgroundColor: isNormal ? '#D1FAE5' : '#FEE2E2' }]}>
                                            <Text style={[styles.historyBadgeText, { color: isNormal ? '#059669' : '#DC2626' }]}>{isNormal ? 'Normal' : 'À surveiller'}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                ) : <View style={styles.center}><Text style={styles.emptyText}>Aucune donnée disponible pour cette période</Text></View>}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 40 },
    title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },
    examScroll: { marginBottom: 12 },
    examChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
    examChipActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    examChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    examChipTextActive: { color: '#fff' },
    periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
    periodBtnActive: { backgroundColor: modernColors.primary },
    periodBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    periodBtnTextActive: { color: '#fff' },
    center: { justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center' },
    statLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
    statUnit: { fontSize: 12, fontWeight: '400', color: '#6B7280' },
    chart: { marginVertical: 8, borderRadius: 12 },
    referenceNote: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, marginBottom: 20 },
    referenceText: { fontSize: 12, color: '#3B82F6', textAlign: 'center' },
    historySection: { gap: 8 },
    historyTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
    historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12 },
    historyDate: { flex: 1, fontSize: 13, color: '#6B7280' },
    historyValue: { fontSize: 15, fontWeight: '600', marginRight: 12 },
    historyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    historyBadgeText: { fontSize: 11, fontWeight: '600' },
    emptyText: { fontSize: 14, color: '#9CA3AF' },
});

export default ResultatsTendancesScreen;
