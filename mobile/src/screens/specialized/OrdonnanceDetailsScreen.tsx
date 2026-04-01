// H2 - Ordonnance numérique partageable (PDF + QR code)
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { hospitalService } from '../../services/hospitalService';
import { modernColors } from '../../theme/modernTheme';

interface Medicament {
    nom: string;
    posologie: string;
    duree?: string;
    frequence?: string;
}

interface Ordonnance {
    id: number;
    consultation_id: number;
    medecin_nom?: string;
    medecin_specialite?: string;
    patient_nom?: string;
    date_emission?: string;
    medicaments: Medicament[];
    instructions?: string;
    valid_until?: string;
}

const OrdonnanceDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute() as any;
    const { consultationId } = route.params || {};

    const [ordonnance, setOrdonnance] = useState<Ordonnance | null>(null);
    const [loading, setLoading] = useState(true);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [loadingShare, setLoadingShare] = useState(false);

    useEffect(() => {
        loadOrdonnance();
    }, []);

    const loadOrdonnance = async () => {
        setLoading(true);
        try {
            const resp = await hospitalService.getOrdonnance(consultationId);
            const data = (resp?.data || resp) as any;
            setOrdonnance(data?.ordonnance || data?.data || null);
        } catch (e) {
            console.warn('[OrdonnanceDetailsScreen] erreur:', e);
        } finally {
            setLoading(false);
        }
    };

    const generateShareLink = async () => {
        setLoadingShare(true);
        try {
            const resp = await hospitalService.generateShareLink(consultationId);
            const data = (resp?.data || resp) as any;
            const url = data?.share_url;
            if (url) setShareUrl(url);
            else Alert.alert('Erreur', 'Impossible de générer le lien de partage');
        } catch (e) {
            Alert.alert('Erreur', 'Impossible de générer le lien de partage');
        } finally {
            setLoadingShare(false);
        }
    };

    const buildHtml = () => {
        if (!ordonnance) return '';
        const medsHtml = ordonnance.medicaments.map(m => `
            <tr>
                <td style="padding:8px;border:1px solid #ddd;">${m.nom}</td>
                <td style="padding:8px;border:1px solid #ddd;">${m.posologie}</td>
                <td style="padding:8px;border:1px solid #ddd;">${m.frequence || '—'}</td>
                <td style="padding:8px;border:1px solid #ddd;">${m.duree || '—'}</td>
            </tr>
        `).join('');

        return `
        <html><head><meta charset="UTF-8"/>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
            h1 { color: #DC2626; font-size: 22px; }
            .info-row { display: flex; gap: 40px; margin-bottom: 20px; }
            .info-item label { font-size: 11px; color: #6B7280; text-transform: uppercase; }
            .info-item p { font-size: 14px; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #FEE2E2; color: #DC2626; padding: 10px; text-align: left; border: 1px solid #ddd; }
            .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 16px; }
        </style>
        </head><body>
        <h1>Ordonnance Médicale</h1>
        <div class="info-row">
            <div class="info-item">
                <label>Médecin</label>
                <p><strong>${ordonnance.medecin_nom || '—'}</strong></p>
                <p>${ordonnance.medecin_specialite || ''}</p>
            </div>
            <div class="info-item">
                <label>Patient</label>
                <p><strong>${ordonnance.patient_nom || '—'}</strong></p>
            </div>
            <div class="info-item">
                <label>Date d'émission</label>
                <p>${ordonnance.date_emission ? new Date(ordonnance.date_emission).toLocaleDateString('fr-FR') : '—'}</p>
            </div>
        </div>
        <table>
            <thead><tr>
                <th>Médicament</th><th>Posologie</th><th>Fréquence</th><th>Durée</th>
            </tr></thead>
            <tbody>${medsHtml}</tbody>
        </table>
        ${ordonnance.instructions ? `<p style="margin-top:20px;"><strong>Instructions :</strong> ${ordonnance.instructions}</p>` : ''}
        <div class="footer">
            <p style="font-size:11px;color:#9CA3AF;">Document généré via Yukpo — ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
        </body></html>`;
    };

    const handleGeneratePdf = async () => {
        if (!ordonnance) return;
        setLoadingPdf(true);
        try {
            const { uri } = await Print.printToFileAsync({ html: buildHtml() });
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Télécharger l\'ordonnance' });
            } else {
                Alert.alert('PDF généré', `Fichier sauvegardé : ${uri}`);
            }
        } catch (e) {
            Alert.alert('Erreur', 'Impossible de générer le PDF');
        } finally {
            setLoadingPdf(false);
        }
    };

    const handleShare = async () => {
        if (!shareUrl) {
            await generateShareLink();
            return;
        }
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(shareUrl);
        }
    };

    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de l'ordonnance...</Text>
            </View>
        );
    }

    if (!ordonnance) {
        return (
            <View style={styles.centered}>
                <SafeIcon name="file-x" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>Ordonnance introuvable</Text>
                <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
                    <Text style={styles.btnBackText}>Retour</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color={modernColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Ordonnance</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Infos médecin/patient */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Médecin</Text>
                            <Text style={styles.infoValue}>{ordonnance.medecin_nom || '—'}</Text>
                            {ordonnance.medecin_specialite && (
                                <Text style={styles.infoSub}>{ordonnance.medecin_specialite}</Text>
                            )}
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Date</Text>
                            <Text style={styles.infoValue}>{formatDate(ordonnance.date_emission)}</Text>
                        </View>
                    </View>
                    {ordonnance.valid_until && (
                        <View style={styles.validityBadge}>
                            <SafeIcon name="calendar-check" size={13} color="#10B981" />
                            <Text style={styles.validityText}>Valable jusqu'au {formatDate(ordonnance.valid_until)}</Text>
                        </View>
                    )}
                </View>

                {/* Médicaments */}
                <Text style={styles.sectionTitle}>Médicaments prescrits</Text>
                {ordonnance.medicaments.map((med, idx) => (
                    <View key={idx} style={styles.medCard}>
                        <View style={styles.medHeader}>
                            <SafeIcon name="pill" size={16} color={modernColors.primary} />
                            <Text style={styles.medName}>{med.nom}</Text>
                        </View>
                        <Text style={styles.medPosologie}>{med.posologie}</Text>
                        <View style={styles.medMeta}>
                            {med.frequence && (
                                <View style={styles.medTag}>
                                    <Text style={styles.medTagText}>{med.frequence}</Text>
                                </View>
                            )}
                            {med.duree && (
                                <View style={styles.medTag}>
                                    <Text style={styles.medTagText}>{med.duree}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                ))}

                {ordonnance.instructions && (
                    <View style={styles.instructionsCard}>
                        <Text style={styles.instructionsTitle}>Instructions</Text>
                        <Text style={styles.instructionsText}>{ordonnance.instructions}</Text>
                    </View>
                )}

                {/* QR Code */}
                <Text style={styles.sectionTitle}>QR Code sécurisé</Text>
                <View style={styles.qrContainer}>
                    <QRCode
                        value={shareUrl || `https://yukpo.app/ordonnance/${ordonnance.id}`}
                        size={160}
                        color="#111827"
                        backgroundColor="#fff"
                    />
                    <Text style={styles.qrHint}>Scannez pour accéder à l'ordonnance en ligne</Text>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.pdfBtn]}
                        onPress={handleGeneratePdf}
                        disabled={loadingPdf}
                    >
                        {loadingPdf ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <SafeIcon name="file-text" size={18} color="#fff" />
                        )}
                        <Text style={styles.actionBtnText}>Générer PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.shareBtn]}
                        onPress={handleShare}
                        disabled={loadingShare}
                    >
                        {loadingShare ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <SafeIcon name="share-2" size={18} color="#fff" />
                        )}
                        <Text style={styles.actionBtnText}>Partager</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: '#6B7280' },
    emptyText: { fontSize: 15, color: '#9CA3AF' },
    btnBack: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: modernColors.primary, borderRadius: 8 },
    btnBackText: { color: '#fff', fontWeight: '600' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: 48, paddingHorizontal: 16, paddingBottom: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    },
    backBtn: { marginRight: 12, padding: 4 },
    title: { fontSize: 20, fontWeight: '700', color: modernColors.textPrimary },
    content: { padding: 16, gap: 16, paddingBottom: 40 },
    infoCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    infoRow: { flexDirection: 'row', gap: 20 },
    infoItem: { flex: 1 },
    infoLabel: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.5 },
    infoValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
    infoSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    validityBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB',
    },
    validityText: { fontSize: 13, color: '#10B981', fontWeight: '500' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 4 },
    medCard: {
        backgroundColor: '#fff', borderRadius: 10, padding: 14,
        borderLeftWidth: 3, borderLeftColor: modernColors.primary,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    },
    medHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    medName: { fontSize: 15, fontWeight: '700', color: '#111827' },
    medPosologie: { fontSize: 14, color: '#374151', marginBottom: 8 },
    medMeta: { flexDirection: 'row', gap: 8 },
    medTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    medTagText: { fontSize: 12, color: '#1D4ED8', fontWeight: '500' },
    instructionsCard: {
        backgroundColor: '#FFFBEB', borderRadius: 10, padding: 14,
        borderLeftWidth: 3, borderLeftColor: '#F59E0B',
    },
    instructionsTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 6 },
    instructionsText: { fontSize: 13, color: '#78350F' },
    qrContainer: {
        backgroundColor: '#fff', borderRadius: 12, padding: 20,
        alignItems: 'center', gap: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    qrHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
    actionsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14, borderRadius: 10,
    },
    pdfBtn: { backgroundColor: '#DC2626' },
    shareBtn: { backgroundColor: '#10B981' },
    actionBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default OrdonnanceDetailsScreen;
