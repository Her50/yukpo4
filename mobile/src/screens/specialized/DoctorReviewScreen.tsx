// H3 - Avis sur médecins individuels (notation étoiles + commentaire)
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { hospitalService } from '../../services/hospitalService';
import { modernColors } from '../../theme/modernTheme';

const DoctorReviewScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute() as any;
    const { doctorId, doctorName, consultationId } = route.params || {};

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Note requise', 'Veuillez sélectionner une note avant de soumettre.');
            return;
        }
        setSubmitting(true);
        try {
            const resp = await hospitalService.submitDoctorReview(doctorId, rating, comment);
            const data = (resp?.data || resp) as any;
            if (resp.success || data?.success) {
                setSubmitted(true);
            } else {
                Alert.alert('Erreur', data?.message || 'Impossible de soumettre votre avis');
            }
        } catch (e) {
            Alert.alert('Erreur', 'Une erreur est survenue');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color={modernColors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Avis soumis</Text>
                </View>
                <View style={styles.successContainer}>
                    <SafeIcon name="check-circle" size={72} color="#10B981" />
                    <Text style={styles.successTitle}>Merci pour votre avis !</Text>
                    <Text style={styles.successSub}>
                        Votre retour aide d'autres patients à choisir leurs médecins.
                    </Text>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.goBack()}>
                        <Text style={styles.btnPrimaryText}>Retour</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color={modernColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Évaluer le médecin</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Médecin */}
                <View style={styles.doctorCard}>
                    <View style={styles.avatarCircle}>
                        <SafeIcon name="user" size={32} color={modernColors.primary} />
                    </View>
                    <View>
                        <Text style={styles.doctorName}>{doctorName || 'Médecin'}</Text>
                        <Text style={styles.doctorSub}>Consultation #{consultationId}</Text>
                    </View>
                </View>

                {/* Étoiles */}
                <Text style={styles.sectionLabel}>Votre note globale</Text>
                <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map(star => (
                        <TouchableOpacity
                            key={star}
                            onPress={() => setRating(star)}
                            style={styles.starBtn}
                        >
                            <SafeIcon
                                name="star"
                                size={40}
                                color={star <= rating ? '#F59E0B' : '#D1D5DB'}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
                {rating > 0 && (
                    <Text style={styles.ratingLabel}>
                        {['', 'Très mauvais', 'Mauvais', 'Correct', 'Bien', 'Excellent'][rating]}
                    </Text>
                )}

                {/* Commentaire */}
                <Text style={styles.sectionLabel}>Commentaire (optionnel)</Text>
                <TextInput
                    style={styles.textarea}
                    placeholder="Décrivez votre expérience avec ce médecin..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={5}
                    value={comment}
                    onChangeText={setComment}
                    textAlignVertical="top"
                />

                <TouchableOpacity
                    style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting || rating === 0}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <SafeIcon name="send" size={18} color="#fff" />
                    )}
                    <Text style={styles.submitBtnText}>
                        {submitting ? 'Envoi en cours...' : 'Soumettre mon avis'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: 48, paddingHorizontal: 16, paddingBottom: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    },
    backBtn: { marginRight: 12, padding: 4 },
    title: { fontSize: 20, fontWeight: '700', color: modernColors.textPrimary },
    content: { padding: 20, gap: 16, paddingBottom: 40 },
    doctorCard: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        backgroundColor: '#fff', borderRadius: 12, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    avatarCircle: {
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: modernColors.primary + '18',
        justifyContent: 'center', alignItems: 'center',
    },
    doctorName: { fontSize: 17, fontWeight: '700', color: '#111827' },
    doctorSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
    sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
    starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    starBtn: { padding: 4 },
    ratingLabel: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#F59E0B' },
    textarea: {
        backgroundColor: '#fff', borderRadius: 10, padding: 14,
        fontSize: 14, color: '#111827', minHeight: 120,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 16, borderRadius: 12,
        backgroundColor: modernColors.primary,
    },
    submitBtnDisabled: { backgroundColor: '#D1D5DB' },
    submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
    successTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
    successSub: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
    btnPrimary: {
        marginTop: 8, paddingHorizontal: 32, paddingVertical: 14,
        backgroundColor: modernColors.primary, borderRadius: 12,
    },
    btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default DoctorReviewScreen;
