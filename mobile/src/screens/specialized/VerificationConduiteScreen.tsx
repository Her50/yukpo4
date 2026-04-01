import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

type DocStatus = 'idle' | 'uploaded' | 'verified' | 'rejected';

interface DocItem {
    key: string;
    label: string;
    description: string;
    icon: string;
    required: boolean;
    status: DocStatus;
    uri?: string;
    fileName?: string;
    rejectionReason?: string;
}

const VerificationConduiteScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { service } = route.params || {}; // 'taxi' | 'covoiturage'

    const [docs, setDocs] = useState<DocItem[]>([
        { key: 'cni_recto', label: "CNI — Recto", description: "Carte nationale d'identité, face avant", icon: 'credit-card', required: true, status: 'idle' },
        { key: 'cni_verso', label: "CNI — Verso", description: "Carte nationale d'identité, face arrière", icon: 'credit-card', required: true, status: 'idle' },
        { key: 'permis', label: "Permis de conduire", description: "Permis valide, catégorie B minimum", icon: 'file-text', required: true, status: 'idle' },
        { key: 'assurance', label: "Attestation d'assurance", description: "Assurance véhicule en cours de validité", icon: 'shield', required: true, status: 'idle' },
        { key: 'visite_technique', label: "Visite technique", description: "Contrôle technique valide (moins de 2 ans)", icon: 'check-circle', required: true, status: 'idle' },
        { key: 'photo_vehicule', label: "Photo du véhicule", description: "Vue de face et de côté du véhicule", icon: 'camera', required: true, status: 'idle' },
        { key: 'casier_judiciaire', label: "Casier judiciaire (B3)", description: "Document de moins de 3 mois", icon: 'file', required: service === 'taxi', status: 'idle' },
    ]);

    const [immatriculation, setImmatriculation] = useState('');
    const [marque, setMarque] = useState('');
    const [modele, setModele] = useState('');
    const [annee, setAnnee] = useState('');
    const [couleur, setCouleur] = useState('');
    const [capacite, setCapacite] = useState('4');
    const [selfieUri, setSelfieUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [existingStatus, setExistingStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');
    const [loading, setLoading] = useState(true);

    useEffect(() => { checkExisting(); }, []);

    const checkExisting = async () => {
        try {
            const res = await apiGet(`/api/verification/driver-status`);
            setExistingStatus(res?.data?.status || 'none');
        } catch { setExistingStatus('none'); }
        finally { setLoading(false); }
    };

    const pickImage = async (docKey: string) => {
        Alert.alert('Ajouter le document', 'Choisissez la source', [
            { text: 'Appareil photo', onPress: () => captureFromCamera(docKey) },
            { text: 'Galerie', onPress: () => pickFromGallery(docKey) },
            { text: 'Fichier PDF', onPress: () => pickFromFiles(docKey) },
            { text: 'Annuler', style: 'cancel' },
        ]);
    };

    const captureFromCamera = async (docKey: string) => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission refusée', 'Accès caméra nécessaire.'); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true });
        if (!result.canceled && result.assets?.[0]) {
            updateDoc(docKey, result.assets[0].uri, result.assets[0].fileName || `${docKey}.jpg`);
        }
    };

    const pickFromGallery = async (docKey: string) => {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: true });
        if (!result.canceled && result.assets?.[0]) {
            updateDoc(docKey, result.assets[0].uri, result.assets[0].fileName || `${docKey}.jpg`);
        }
    };

    const pickFromFiles = async (docKey: string) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
            if (!result.canceled && result.assets?.[0]) {
                updateDoc(docKey, result.assets[0].uri, result.assets[0].name);
            }
        } catch { Alert.alert('Erreur', 'Impossible de sélectionner le fichier.'); }
    };

    const updateDoc = (key: string, uri: string, fileName: string) => {
        setDocs(prev => prev.map(d => d.key === key ? { ...d, status: 'uploaded', uri, fileName } : d));
    };

    const takeSelfie = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const result = await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true, aspect: [1, 1], cameraType: ImagePicker.CameraType.front });
        if (!result.canceled && result.assets?.[0]) setSelfieUri(result.assets[0].uri);
    };

    const handleSubmit = async () => {
        const missing = docs.filter(d => d.required && d.status === 'idle');
        if (missing.length > 0) {
            Alert.alert('Documents manquants', `Ajoutez : ${missing.map(d => d.label).join(', ')}`);
            return;
        }
        if (!immatriculation.trim() || !marque.trim()) {
            Alert.alert('Véhicule requis', 'Renseignez l\'immatriculation et la marque du véhicule.');
            return;
        }
        if (!selfieUri) {
            Alert.alert('Selfie requis', 'Prenez un selfie pour vérifier votre identité.');
            return;
        }

        setSubmitting(true);
        try {
            await apiPost('/api/verification/driver', {
                service,
                documents: docs.filter(d => d.uploaded || d.status === 'uploaded').map(d => ({ key: d.key, fileName: d.fileName })),
                vehicule: { immatriculation: immatriculation.trim(), marque: marque.trim(), modele: modele.trim(), annee: parseInt(annee) || undefined, couleur: couleur.trim(), capacite: parseInt(capacite) || 4 },
            });
            Alert.alert(
                'Demande envoyée !',
                'Votre dossier de vérification a été transmis. La vérification prend généralement 24-48h. Vous serez notifié du résultat.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch {
            Alert.alert('Erreur', 'Impossible d\'envoyer la demande. Vérifiez votre connexion.');
        } finally { setSubmitting(false); }
    };

    const uploadedCount = docs.filter(d => d.status === 'uploaded' || d.status === 'verified').length;
    const requiredCount = docs.filter(d => d.required).length;

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} /></View>;

    // Already verified
    if (existingStatus === 'verified') {
        return (
            <View style={styles.center}>
                <View style={styles.verifiedBadge}>
                    <SafeIcon name="shield" size={48} color="#059669" />
                </View>
                <Text style={styles.verifiedTitle}>Profil vérifié ✓</Text>
                <Text style={styles.verifiedSub}>Votre identité et votre véhicule ont été vérifiés avec succès. Vous pouvez accepter des passagers.</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>Retour</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Pending review
    if (existingStatus === 'pending') {
        return (
            <View style={styles.center}>
                <SafeIcon name="clock" size={48} color="#D97706" />
                <Text style={[styles.verifiedTitle, { color: '#D97706' }]}>En cours de vérification</Text>
                <Text style={styles.verifiedSub}>Votre dossier est en cours d'examen. Résultat attendu sous 24-48h.</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>Retour</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Trust badge */}
            <View style={styles.trustCard}>
                <SafeIcon name="shield" size={22} color={modernColors.primary} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.trustTitle}>Vérification conducteur</Text>
                    <Text style={styles.trustSub}>Cette vérification garantit la sécurité des passagers et renforce votre crédibilité. Badge "Vérifié" affiché sur votre profil.</Text>
                </View>
            </View>

            {/* Progress */}
            <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Documents fournis</Text>
                    <Text style={styles.progressCount}>{uploadedCount}/{docs.length}</Text>
                </View>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(uploadedCount / docs.length) * 100}%` }]} />
                </View>
            </View>

            {/* Documents */}
            <Text style={styles.sectionTitle}>Documents d'identité et véhicule</Text>
            {docs.map(doc => (
                <TouchableOpacity key={doc.key} style={[styles.docCard, doc.status !== 'idle' && styles.docCardDone, doc.status === 'rejected' && styles.docCardRejected]} onPress={() => pickImage(doc.key)}>
                    {doc.uri && doc.uri.startsWith('file') ? (
                        <Image source={{ uri: doc.uri }} style={styles.docThumb} />
                    ) : (
                        <View style={[styles.docIcon, { backgroundColor: doc.status !== 'idle' ? '#D1FAE5' : '#F3F4F6' }]}>
                            <SafeIcon name={doc.icon as any} size={22} color={doc.status !== 'idle' ? '#059669' : '#6B7280'} />
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.docLabel}>{doc.label}{doc.required ? ' *' : ''}</Text>
                        <Text style={styles.docDesc}>{doc.status === 'uploaded' ? doc.fileName || 'Document ajouté' : doc.description}</Text>
                        {doc.status === 'rejected' && doc.rejectionReason && <Text style={styles.rejectedText}>{doc.rejectionReason}</Text>}
                    </View>
                    {doc.status === 'uploaded' || doc.status === 'verified'
                        ? <SafeIcon name="check-circle" size={22} color="#059669" />
                        : doc.status === 'rejected'
                        ? <SafeIcon name="x-circle" size={22} color="#DC2626" />
                        : <SafeIcon name="upload" size={22} color="#9CA3AF" />
                    }
                </TouchableOpacity>
            ))}

            {/* Selfie */}
            <Text style={styles.sectionTitle}>Selfie de vérification</Text>
            <View style={styles.selfieSection}>
                <Text style={styles.selfieDesc}>Prenez un selfie pour confirmer que vous êtes bien le titulaire des documents fournis.</Text>
                <TouchableOpacity style={styles.selfieBtn} onPress={takeSelfie}>
                    {selfieUri ? (
                        <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
                    ) : (
                        <View style={styles.selfiePlaceholder}>
                            <SafeIcon name="camera" size={32} color="#9CA3AF" />
                            <Text style={styles.selfiePlaceholderText}>Prendre un selfie</Text>
                        </View>
                    )}
                </TouchableOpacity>
                {selfieUri && <Text style={styles.selfieOk}>✓ Selfie enregistré</Text>}
            </View>

            {/* Vehicle info */}
            <Text style={styles.sectionTitle}>Informations du véhicule</Text>
            <Text style={styles.label}>Plaque d'immatriculation *</Text>
            <TextInput style={[styles.input, styles.plateInput]} value={immatriculation} onChangeText={t => setImmatriculation(t.toUpperCase())} placeholder="LT 1234 A" autoCapitalize="characters" />
            <View style={styles.row}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Marque *</Text>
                    <TextInput style={styles.input} value={marque} onChangeText={setMarque} placeholder="Toyota, Renault..." />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Modèle</Text>
                    <TextInput style={styles.input} value={modele} onChangeText={setModele} placeholder="Corolla, Clio..." />
                </View>
            </View>
            <View style={styles.row}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Année</Text>
                    <TextInput style={styles.input} value={annee} onChangeText={setAnnee} placeholder="2018" keyboardType="numeric" maxLength={4} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Couleur</Text>
                    <TextInput style={styles.input} value={couleur} onChangeText={setCouleur} placeholder="Blanc, Gris..." />
                </View>
            </View>
            <Text style={styles.label}>Nombre de places passagers</Text>
            <View style={styles.placesRow}>
                {['2', '3', '4', '5', '6', '7'].map(p => (
                    <TouchableOpacity key={p} style={[styles.placeBtn, capacite === p && styles.placeBtnActive]} onPress={() => setCapacite(p)}>
                        <Text style={[styles.placeBtnText, capacite === p && styles.placeBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Privacy note */}
            <View style={styles.privacyNote}>
                <SafeIcon name="lock" size={14} color="#6B7280" />
                <Text style={styles.privacyText}>Vos documents sont chiffrés et traités uniquement à des fins de vérification d'identité. Ils ne sont pas partagés avec des tiers.</Text>
            </View>

            <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <SafeIcon name="shield" size={20} color="#fff" />}
                <Text style={styles.submitBtnText}>{submitting ? 'Envoi en cours...' : 'Soumettre pour vérification'}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
    verifiedBadge: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center' },
    verifiedTitle: { fontSize: 22, fontWeight: '800', color: '#059669', textAlign: 'center' },
    verifiedSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
    backBtn: { marginTop: 12, backgroundColor: modernColors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
    backBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    trustCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#BFDBFE' },
    trustTitle: { fontSize: 15, fontWeight: '700', color: '#1D4ED8', marginBottom: 4 },
    trustSub: { fontSize: 13, color: '#3B82F6', lineHeight: 19 },
    progressSection: { marginBottom: 20 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    progressLabel: { fontSize: 13, color: '#374151', fontWeight: '600' },
    progressCount: { fontSize: 13, fontWeight: '700', color: modernColors.primary },
    progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: modernColors.primary, borderRadius: 4 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12, marginTop: 8 },
    docCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    docCardDone: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
    docCardRejected: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
    docThumb: { width: 48, height: 48, borderRadius: 8 },
    docIcon: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    docLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
    docDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    rejectedText: { fontSize: 12, color: '#DC2626', marginTop: 2 },
    selfieSection: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 8, alignItems: 'center' },
    selfieDesc: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 14, lineHeight: 19 },
    selfieBtn: { width: 130, height: 130, borderRadius: 65, overflow: 'hidden', borderWidth: 2, borderColor: '#D1D5DB' },
    selfiePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6' },
    selfiePlaceholderText: { fontSize: 12, color: '#9CA3AF' },
    selfieImage: { width: '100%', height: '100%' },
    selfieOk: { fontSize: 13, color: '#059669', fontWeight: '700', marginTop: 10 },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 14 },
    plateInput: { fontSize: 18, fontWeight: '700', letterSpacing: 2, textAlign: 'center' },
    row: { flexDirection: 'row', gap: 12 },
    placesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    placeBtn: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    placeBtnActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    placeBtnText: { fontSize: 16, fontWeight: '700', color: '#374151' },
    placeBtnTextActive: { color: '#fff' },
    privacyNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginTop: 16, marginBottom: 8 },
    privacyText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16, backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 14 },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

export default VerificationConduiteScreen;