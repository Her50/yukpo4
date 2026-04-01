/**
 * Modal de notation post-trajet (taxi ou covoiturage)
 * Apparaît automatiquement quand une réservation passe à "completed"
 */
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from './SafeIcon';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface Props {
    visible: boolean;
    onClose: () => void;
    onRated: () => void;
    reservationId: number;
    ratedUserId: number;
    serviceType: 'taxi' | 'covoiturage';
    driverName?: string;
}

const PostTripRatingModal: React.FC<Props> = ({
    visible, onClose, onRated, reservationId, ratedUserId, serviceType, driverName,
}) => {
    const [rating, setRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const QUICK_COMMENTS = [
        'Très ponctuel',
        'Conduite agréable',
        'Véhicule propre',
        'Très sympathique',
        'Trajet confortable',
    ];

    const RATING_LABELS: Record<number, string> = {
        1: 'Très mauvais',
        2: 'Mauvais',
        3: 'Correct',
        4: 'Bien',
        5: 'Excellent !',
    };

    const [pointsEarned, setPointsEarned] = useState(0);

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Note requise', 'Veuillez sélectionner une note entre 1 et 5 étoiles.');
            return;
        }
        try {
            setLoading(true);
            const res = await apiPost('/api/reservations/rate', {
                reservation_id: reservationId,
                rated_user_id: ratedUserId,
                rating,
                comment: comment.trim() || undefined,
                service_type: serviceType,
            });
            const data = (res?.data || res) as any;
            if (data?.success) {
                // Auto-credit loyalty points for leaving a rating
                let pts = 0;
                try {
                    const loyaltyRes = await apiPost(`/api/reservations/${reservationId}/loyalty-credit`, {});
                    const loyaltyData = (loyaltyRes?.data || loyaltyRes) as any;
                    pts = loyaltyData?.points_credited || 0;
                } catch { /* non-blocking */ }
                setPointsEarned(pts);
                setSubmitted(true);
                onRated();
            } else {
                Alert.alert('Erreur', data?.error || 'Impossible de soumettre la note.');
            }
        } catch (err: any) {
            Alert.alert('Erreur', err?.message || 'Erreur réseau.');
        } finally {
            setLoading(false);
        }
    };

    const displayStar = hoveredStar || rating;
    const icon = serviceType === 'taxi' ? 'car' : 'users';
    const color = serviceType === 'taxi' ? '#D97706' : '#10B981';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={st.overlay}>
                <View style={st.card}>
                    {/* Header */}
                    <View style={[st.iconWrap, { backgroundColor: color + '20' }]}>
                        <SafeIcon name={icon} size={32} color={color} />
                    </View>
                    <Text style={st.title}>Trajet terminé !</Text>
                    <Text style={st.subtitle}>
                        Comment s'est passé votre trajet{driverName ? ` avec ${driverName}` : ''} ?
                    </Text>

                    {!submitted ? (
                        <>
                            {/* Étoiles */}
                            <View style={st.starsRow}>
                                {[1, 2, 3, 4, 5].map(s => (
                                    <TouchableOpacity
                                        key={s}
                                        onPress={() => { setRating(s); setHoveredStar(0); }}
                                        onPressIn={() => setHoveredStar(s)}
                                        onPressOut={() => setHoveredStar(0)}
                                        style={st.starBtn}
                                    >
                                        <SafeIcon
                                            name="star"
                                            size={36}
                                            color={s <= displayStar ? '#FCD34D' : '#E5E7EB'}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {displayStar > 0 && (
                                <Text style={[st.ratingLabel, { color }]}>{RATING_LABELS[displayStar]}</Text>
                            )}

                            {/* Commentaires rapides */}
                            {rating >= 4 && (
                                <View style={st.quickRow}>
                                    {QUICK_COMMENTS.map(q => (
                                        <TouchableOpacity
                                            key={q}
                                            style={[st.quickChip, comment === q && { backgroundColor: color + '20', borderColor: color }]}
                                            onPress={() => setComment(comment === q ? '' : q)}
                                        >
                                            <Text style={[st.quickChipText, comment === q && { color }]}>{q}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Commentaire libre */}
                            <TextInput
                                style={st.commentInput}
                                placeholder="Ajouter un commentaire (optionnel)..."
                                value={comment}
                                onChangeText={setComment}
                                multiline
                                maxLength={300}
                                placeholderTextColor="#9CA3AF"
                            />

                            {/* Boutons */}
                            <View style={st.buttonsRow}>
                                <TouchableOpacity style={st.skipBtn} onPress={onClose}>
                                    <Text style={st.skipBtnText}>Plus tard</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[st.submitBtn, { backgroundColor: color }, (loading || rating === 0) && { opacity: 0.5 }]}
                                    onPress={handleSubmit}
                                    disabled={loading || rating === 0}
                                >
                                    {loading
                                        ? <ActivityIndicator color="#fff" size="small" />
                                        : <SafeIcon name="send" size={16} color="#fff" />}
                                    <Text style={st.submitBtnText}>
                                        {loading ? 'Envoi...' : 'Envoyer'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View style={st.successBox}>
                            <SafeIcon name="check-circle" size={52} color="#10B981" />
                            <Text style={st.successTitle}>Merci !</Text>
                            <Text style={st.successText}>
                                Votre avis aide à améliorer la qualité des trajets.
                            </Text>
                            {pointsEarned > 0 && (
                                <View style={st.pointsBadge}>
                                    <SafeIcon name="zap" size={16} color="#D97706" />
                                    <Text style={st.pointsBadgeText}>+{pointsEarned} points fidélité gagnés !</Text>
                                </View>
                            )}
                            <TouchableOpacity style={[st.submitBtn, { backgroundColor: '#10B981', alignSelf: 'center', paddingHorizontal: 32 }]} onPress={onClose}>
                                <Text style={st.submitBtnText}>Fermer</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const st = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center' },
    iconWrap: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
    subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
    starsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    starBtn: { padding: 4 },
    ratingLabel: { fontSize: 15, fontWeight: '700', marginBottom: 16 },
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
    quickChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
    quickChipText: { fontSize: 12, color: '#6B7280' },
    commentInput: { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', minHeight: 72, textAlignVertical: 'top', marginBottom: 20 },
    buttonsRow: { flexDirection: 'row', gap: 12, width: '100%' },
    skipBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
    skipBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
    submitBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12 },
    submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    successBox: { alignItems: 'center', gap: 12, width: '100%' },
    successTitle: { fontSize: 20, fontWeight: '800', color: '#065F46' },
    successText: { fontSize: 14, color: '#047857', textAlign: 'center' },
    pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#FCD34D' },
    pointsBadgeText: { fontSize: 13, fontWeight: '700', color: '#D97706' },
});

export default PostTripRatingModal;
