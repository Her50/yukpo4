import { useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const severityColor: Record<string, string> = { normal: '#059669', elevated: '#D97706', critical: '#DC2626', low: '#3B82F6' };
const severityLabel: Record<string, string> = { normal: 'NORMAL', elevated: 'ÉLEVÉ', critical: 'CRITIQUE', low: 'BAS' };

const LabResultDetailsScreen: React.FC = () => {
    const route = useRoute() as any;
    const { examinationId, examinationName } = route.params || {};
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadResults(); }, []);

    const loadResults = async () => {
        try {
            const res = await apiGet(`/api/laboratoires/examinations/${examinationId}/full-results`);
            setData(res?.data);
        } catch { Alert.alert('Erreur', 'Impossible de charger les résultats.'); }
        finally { setLoading(false); }
    };

    const generatePDF = async () => {
        if (!data) return;
        const rows = (data.parameters || []).map((p: any) => `
            <tr style="background:${p.severity === 'critical' ? '#FEE2E2' : p.severity === 'elevated' ? '#FEF3C7' : '#fff'}">
                <td style="padding:8px;border:1px solid #ddd">${p.name}</td>
                <td style="padding:8px;border:1px solid #ddd;font-weight:bold">${p.value} ${p.unit || ''}</td>
                <td style="padding:8px;border:1px solid #ddd">${p.reference_range || '-'}</td>
                <td style="padding:8px;border:1px solid #ddd;color:${severityColor[p.severity] || '#059669'}">${severityLabel[p.severity] || 'NORMAL'}</td>
            </tr>`).join('');
        const html = `<html><body style="font-family:sans-serif;padding:20px">
            <h2>${examinationName || 'Résultats d\'examen'}</h2>
            <p>Date: ${data.date ? new Date(data.date).toLocaleDateString('fr-FR') : 'N/A'}</p>
            <p>Laboratoire: ${data.laboratory_name || '-'}</p>
            <table style="width:100%;border-collapse:collapse">
                <tr style="background:#F3F4F6"><th style="padding:8px;border:1px solid #ddd">Paramètre</th><th style="padding:8px;border:1px solid #ddd">Valeur</th><th style="padding:8px;border:1px solid #ddd">Référence</th><th style="padding:8px;border:1px solid #ddd">Statut</th></tr>
                ${rows}
            </table>
        </body></html>`;
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    };

    const generateShareLink = async () => {
        try {
            const res = await apiPost(`/api/laboratoires/examinations/${examinationId}/share-link`, { expires_in_hours: 72 });
            const link = res?.data?.share_url || `https://yukpomnang.com/results/${res?.data?.token}`;
            await Share.share({ message: `Résultats d'examen partagés avec vous: ${link}` });
        } catch { Alert.alert('Erreur', 'Impossible de générer le lien.'); }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>;
    if (!data) return <View style={styles.center}><Text style={styles.emptyText}>Résultats non disponibles</Text></View>;

    return (
        <View style={styles.container}>
            <View style={styles.headerCard}>
                <Text style={styles.examName}>{examinationName || 'Résultats d\'examen'}</Text>
                <Text style={styles.examMeta}>{data.laboratory_name} · {data.date ? new Date(data.date).toLocaleDateString('fr-FR') : '-'}</Text>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={generatePDF}>
                        <SafeIcon name="download" size={16} color={modernColors.primary} />
                        <Text style={styles.actionBtnText}>PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={generateShareLink}>
                        <SafeIcon name="share-2" size={16} color={modernColors.primary} />
                        <Text style={styles.actionBtnText}>Partager</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <FlatList
                data={data.parameters || []}
                keyExtractor={(_, i) => i.toString()}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => {
                    const color = severityColor[item.severity] || '#059669';
                    const label = severityLabel[item.severity] || 'NORMAL';
                    return (
                        <View style={[styles.paramCard, item.severity === 'critical' && styles.paramCardCritical]}>
                            <View style={styles.paramTop}>
                                <Text style={styles.paramName}>{item.name}</Text>
                                <View style={[styles.severityBadge, { backgroundColor: `${color}20` }]}>
                                    <Text style={[styles.severityText, { color }]}>{label}</Text>
                                </View>
                            </View>
                            <View style={styles.paramBottom}>
                                <Text style={[styles.paramValue, { color }]}>{item.value} {item.unit || ''}</Text>
                                {item.reference_range && <Text style={styles.paramRef}>Réf: {item.reference_range}</Text>}
                            </View>
                        </View>
                    );
                }}
                ListFooterComponent={data.interpretation ? <View style={styles.interpretationCard}><Text style={styles.interpretationTitle}>Interprétation</Text><Text style={styles.interpretationText}>{data.interpretation}</Text></View> : null}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 14, color: '#9CA3AF' },
    headerCard: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    examName: { fontSize: 18, fontWeight: '700', color: '#111827' },
    examMeta: { fontSize: 13, color: '#6B7280', marginTop: 4, marginBottom: 12 },
    actions: { flexDirection: 'row', gap: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: modernColors.primary },
    actionBtnText: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },
    list: { padding: 16, gap: 10 },
    paramCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    paramCardCritical: { borderLeftColor: '#DC2626', backgroundColor: '#FFF5F5' },
    paramTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    paramName: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
    severityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    severityText: { fontSize: 11, fontWeight: '700' },
    paramBottom: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
    paramValue: { fontSize: 20, fontWeight: '700' },
    paramRef: { fontSize: 12, color: '#9CA3AF' },
    interpretationCard: { margin: 4, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14 },
    interpretationTitle: { fontSize: 14, fontWeight: '700', color: '#1D4ED8', marginBottom: 6 },
    interpretationText: { fontSize: 14, color: '#1E40AF', lineHeight: 20 },
});

export default LabResultDetailsScreen;
