import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

interface DossierDoc {
    key: string;
    label: string;
    required: boolean;
    icon: string;
    uploaded?: boolean;
    fileName?: string;
}

const REQUIRED_DOCS: DossierDoc[] = [
    { key: 'cni', label: "Pièce d'identité (CNI)", required: true, icon: 'credit-card' },
    { key: 'bulletins_salaire', label: 'Bulletins de salaire (3 derniers)', required: true, icon: 'file-text' },
    { key: 'justificatif_domicile', label: 'Justificatif de domicile', required: true, icon: 'home' },
    { key: 'contrat_travail', label: 'Contrat de travail', required: true, icon: 'briefcase' },
    { key: 'releve_bancaire', label: 'Relevé bancaire (3 mois)', required: false, icon: 'bar-chart-2' },
    { key: 'attestation_employeur', label: "Attestation de l'employeur", required: false, icon: 'award' },
    { key: 'garant_cni', label: "CNI du garant (si applicable)", required: false, icon: 'user' },
];

const DossierLocationScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { propertyId, propertyTitle } = route.params || {};

    const [docs, setDocs] = useState<DossierDoc[]>(REQUIRED_DOCS);
    const [nom, setNom] = useState('');
    const [profession, setProfession] = useState('');
    const [salaire, setSalaire] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [existingStatus, setExistingStatus] = useState<string | null>(null);

    useEffect(() => { checkExisting(); }, []);

    const checkExisting = async () => {
        setLoading(true);
        try {
            const res = await apiGet(`/api/immobilier/dossier-location/${propertyId}/status`);
            setExistingStatus(res?.data?.status || null);
        } catch { } finally { setLoading(false); }
    };

    const pickDocument = async (docKey: string) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
            if (result.canceled) return;
            const file = result.assets?.[0];
            if (!file) return;
            setDocs(prev => prev.map(d => d.key === docKey ? { ...d, uploaded: true, fileName: file.name } : d));
        } catch {
            Alert.alert('Erreur', 'Impossible de sélectionner le document.');
        }
    };

    const handleSubmit = async () => {
        const missingRequired = docs.filter(d => d.required && !d.uploaded);
        if (missingRequired.length > 0) {
            Alert.alert('Documents manquants', `Veuillez fournir : ${missingRequired.map(d => d.label).join(', ')}`);
            return;
        }
        if (!nom.trim()) {
            Alert.alert('Champ requis', 'Veuillez indiquer votre nom complet.');
            return;
        }
        setSubmitting(true);
        try {
            await apiPost(`/api/immobilier/dossier-location/${propertyId}`, {
                nom: nom.trim(),
                profession: profession.trim(),
                salaire_mensuel: parseFloat(salaire) || undefined,
                message: message.trim(),
                documents: docs.filter(d => d.uploaded).map(d => d.key),
            });
            Alert.alert(
                'Dossier envoyé !',
                'Votre dossier de location a été transmis au propriétaire. Vous serez contacté dans les 48h.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch {
            Alert.alert('Erreur', 'Impossible d\'envoyer le dossier.');
        } finally { setSubmitting(false); }
    };

    const uploadedCount = docs.filter(d => d.uploaded).length;
    const requiredUploadedCount = docs.filter(d => d.required && d.uploaded).length;
    const totalRequired = docs.filter(d => d.required).length;

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>;

    if (existingStatus) {
        const statusMap: Record<string, { label: string; color: string; icon: string }> = {
            pending: { label: 'En attente de réponse', color: '#D97706', icon: 'clock' },
            approved: { label: 'Dossier accepté', color: '#059669', icon: 'check-circle' },
            rejected: { label: 'Dossier refusé', color: '#DC2626', icon: 'x-circle' },
        };
        const s = statusMap[existingStatus] || statusMap.pending;
        return (
            <View style={styles.center}>
                <SafeIcon name={s.icon as any} size={56} color={s.color} />
                <Text style={[styles.statusTitle, { color: s.color }]}>{s.label}</Text>
                <Text style={styles.statusSub}>Vous avez déjà soumis un dossier pour ce bien.</Text>
                {existingStatus === 'rejected' && (
                    <TouchableOpacity style={styles.retryBtn} onPress={() => setExistingStatus(null)}>
                        <Text style={styles.retryBtnText}>Soumettre un nouveau dossier</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {propertyTitle && (
                <View style={styles.propertyBanner}>
                    <SafeIcon name="home" size={16} color={modernColors.primary} />
                    <Text style={styles.propertyTitle} numberOfLines={2}>{propertyTitle}</Text>
                </View>
            )}

            {/* Progress */}
            <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Documents obligatoires</Text>
                    <Text style={styles.progressCount}>{requiredUploadedCount}/{totalRequired}</Text>
                </View>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(requiredUploadedCount / totalRequired) * 100}%` }]} />
                </View>
            </View>

            {/* Profile */}
            <Text style={styles.sectionTitle}>Votre profil</Text>
            <Text style={styles.label}>Nom complet *</Text>
            <TextInput style={styles.input} value={nom} onChangeText={setNom} placeholder="Prénom NOM" />
            <Text style={styles.label}>Profession</Text>
            <TextInput style={styles.input} value={profession} onChangeText={setProfession} placeholder="Ex: Ingénieur, Fonctionnaire..." />
            <Text style={styles.label}>Salaire mensuel net (FCFA)</Text>
            <TextInput style={styles.input} value={salaire} onChangeText={setSalaire} placeholder="Ex: 250000" keyboardType="numeric" />

            {/* Documents */}
            <Text style={styles.sectionTitle}>Documents</Text>
            {docs.map(doc => (
                <TouchableOpacity key={doc.key} style={[styles.docCard, doc.uploaded && styles.docCardUploaded]} onPress={() => pickDocument(doc.key)}>
                    <View style={[styles.docIcon, { backgroundColor: doc.uploaded ? '#D1FAE5' : '#F3F4F6' }]}>
                        <SafeIcon name={doc.icon as any} size={20} color={doc.uploaded ? '#059669' : '#6B7280'} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.docLabel}>{doc.label}</Text>
                        {doc.uploaded ? (
                            <Text style={styles.docFileName} numberOfLines={1}>{doc.fileName || 'Document chargé'}</Text>
                        ) : (
                            <Text style={styles.docHint}>{doc.required ? 'Obligatoire' : 'Optionnel'} • Appuyez pour ajouter</Text>
                        )}
                    </View>
                    {doc.uploaded ? (
                        <SafeIcon name="check-circle" size={22} color="#059669" />
                    ) : (
                        <SafeIcon name="upload" size={22} color="#9CA3AF" />
                    )}
                </TouchableOpacity>
            ))}

            {/* Message */}
            <Text style={styles.label}>Message au propriétaire (optionnel)</Text>
            <TextInput style={styles.textarea} value={message} onChangeText={setMessage} placeholder="Présentez-vous brièvement..." multiline numberOfLines={4} textAlignVertical="top" />

            <View style={styles.summaryCard}>
                <SafeIcon name="file-text" size={16} color="#6B7280" />
                <Text style={styles.summaryText}>{uploadedCount} document(s) prêt(s) à être envoyé(s)</Text>
            </View>

            <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
                <Text style={styles.submitBtnText}>{submitting ? 'Envoi...' : 'Envoyer mon dossier'}</Text>
            </TouchableOpacity>

            <Text style={styles.footNote}>Vos documents sont transmis de façon sécurisée et ne seront utilisés qu'à des fins de vérification.</Text>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
    statusTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
    statusSub: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
    retryBtn: { marginTop: 16, backgroundColor: modernColors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    propertyBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 16 },
    propertyTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1D4ED8' },
    progressSection: { marginBottom: 20 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    progressLabel: { fontSize: 13, color: '#374151', fontWeight: '600' },
    progressCount: { fontSize: 13, fontWeight: '700', color: modernColors.primary },
    progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: modernColors.primary, borderRadius: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 12 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14 },
    docCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    docCardUploaded: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
    docIcon: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    docLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
    docFileName: { fontSize: 12, color: '#059669', marginTop: 2 },
    docHint: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    textarea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#fff', fontSize: 14, minHeight: 90 },
    summaryCard: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginTop: 16 },
    summaryText: { fontSize: 13, color: '#374151' },
    submitBtn: { marginTop: 20, backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    footNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 16, lineHeight: 18 },
});

export default DossierLocationScreen;
