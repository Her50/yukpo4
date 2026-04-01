import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const STARS = [1, 2, 3, 4, 5];

const PostConsultationFeedbackScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { consultationId, doctorName, hospitalName } = route.params || {};

    const [rating, setRating] = useState(0);
    const [symptomsResolved, setSymptomsResolved] = useState<boolean | null>(null);
    const [needsFollowUp, setNeedsFollowUp] = useState<boolean | null>(null);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) { Alert.alert('Évaluation requise', 'Veuillez noter la consultation.'); return; }
        setLoading(true);
        try {
            await apiPost(`/api/hopitaux/consultations/${consultationId}/feedback`, {
                rating, symptoms_resolved: symptomsResolved, needs_follow_up: needsFollowUp, comment,
            });
            Alert.alert('Merci !', 'Votre retour a été enregistré.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch {
            Alert.alert('Erreur', 'Impossible d\'envoyer le feedback.');
        } finally { setLoading(false); }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Comment s'est passée votre consultation ?</Text>
            {doctorName && <Text style={styles.subtitle}>Dr {doctorName} — {hospitalName}</Text>}

            <View style={styles.section}>
                <Text style={styles.label}>Note globale</Text>
                <View style={styles.starsRow}>
                    {STARS.map(s => (
                        <TouchableOpacity key={s} onPress={() => setRating(s)}>
                            <SafeIcon name="star" size={36} color={s <= rating ? '#F59E0B' : '#D1D5DB'} />
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.ratingLabel}>
                    {rating === 1 ? 'Très mauvaise' : rating === 2 ? 'Mauvaise' : rating === 3 ? 'Correcte' : rating === 4 ? 'Bonne' : rating === 5 ? 'Excellente' : ''}
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Vos symptômes se sont-ils améliorés ?</Text>
                <View style={styles.boolRow}>
                    {[{ label: 'Oui', val: true }, { label: 'Non', val: false }].map(({ label, val }) => (
                        <TouchableOpacity key={label} style={[styles.boolBtn, symptomsResolved === val && styles.boolBtnActive]} onPress={() => setSymptomsResolved(val)}>
                            <Text style={[styles.boolBtnText, symptomsResolved === val && styles.boolBtnTextActive]}>{label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Avez-vous besoin d'un suivi ?</Text>
                <View style={styles.boolRow}>
                    {[{ label: 'Oui', val: true }, { label: 'Non', val: false }].map(({ label, val }) => (
                        <TouchableOpacity key={label} style={[styles.boolBtn, needsFollowUp === val && styles.boolBtnActive]} onPress={() => setNeedsFollowUp(val)}>
                            <Text style={[styles.boolBtnText, needsFollowUp === val && styles.boolBtnTextActive]}>{label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Commentaire (optionnel)</Text>
                <TextInput style={styles.textarea} value={comment} onChangeText={setComment} placeholder="Partagez votre expérience..." multiline numberOfLines={4} textAlignVertical="top" />
            </View>

            <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
                <Text style={styles.submitBtnText}>{loading ? 'Envoi...' : 'Envoyer mon avis'}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 20 },
    title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
    subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
    section: { marginBottom: 24 },
    label: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12 },
    starsRow: { flexDirection: 'row', gap: 8 },
    ratingLabel: { marginTop: 8, fontSize: 14, color: '#6B7280', fontStyle: 'italic' },
    boolRow: { flexDirection: 'row', gap: 12 },
    boolBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
    boolBtnActive: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    boolBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
    boolBtnTextActive: { color: '#fff' },
    textarea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', minHeight: 100, backgroundColor: '#fff' },
    submitBtn: { backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default PostConsultationFeedbackScreen;
