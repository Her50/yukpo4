import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { taxiService } from '../../services/taxiService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

const TAGS = ['Ponctuel', 'Véhicule propre', 'Conducteur agréable', 'Connaît bien le trajet', 'Conduite sûre', 'Prix correct'];

const TaxiRatingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { rideId, driverName, rideDate, departure, destination } = route.params || {};
    const [rating, setRating] = useState(0);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    const toggleTag = (tag: string) => setSelectedTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]);

    const handleSubmit = async () => {
        if (rating === 0) { Alert.alert('Note requise', 'Veuillez noter la course.'); return; }
        setLoading(true);
        try {
            await taxiService.submitRating(rideId, rating, comment, selectedTags);
            Alert.alert('Merci !', 'Votre avis a bien été enregistré.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch { Alert.alert('Erreur', 'Impossible d\'enregistrer la note.'); }
        finally { setLoading(false); }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.tripSummary}>
                <Text style={styles.tripRoute}>{departure || 'Départ'} → {destination || 'Arrivée'}</Text>
                {rideDate && <Text style={styles.tripDate}>{new Date(rideDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</Text>}
                {driverName && <Text style={styles.tripDriver}>Chauffeur : {driverName}</Text>}
            </View>

            <Text style={styles.question}>Comment s'est passée votre course ?</Text>
            <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(s => (
                    <TouchableOpacity key={s} onPress={() => setRating(s)} style={styles.starBtn}>
                        <Text style={[styles.star, s <= rating && styles.starActive]}>★</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {rating > 0 && <Text style={styles.ratingLabel}>{['', 'Très mauvaise', 'Mauvaise', 'Correcte', 'Bonne', 'Excellente'][rating]}</Text>}

            {rating >= 4 && (
                <>
                    <Text style={styles.tagsTitle}>Qu'avez-vous apprécié ?</Text>
                    <View style={styles.tagsWrap}>
                        {TAGS.map(t => (
                            <TouchableOpacity key={t} style={[styles.tag, selectedTags.includes(t) && styles.tagActive]} onPress={() => toggleTag(t)}>
                                <Text style={[styles.tagText, selectedTags.includes(t) && styles.tagTextActive]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            <Text style={styles.commentLabel}>Commentaire (optionnel)</Text>
            <TextInput style={styles.textarea} value={comment} onChangeText={setComment} placeholder="Partagez votre expérience..." multiline numberOfLines={4} textAlignVertical="top" />

            <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
                <Text style={styles.submitBtnText}>{loading ? 'Envoi...' : 'Envoyer mon avis'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.skipBtnText}>Passer</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 20, paddingBottom: 40 },
    tripSummary: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: modernColors.primary },
    tripRoute: { fontSize: 16, fontWeight: '700', color: '#111827' },
    tripDate: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    tripDriver: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    question: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 16 },
    starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
    starBtn: { padding: 4 },
    star: { fontSize: 44, color: '#D1D5DB' },
    starActive: { color: '#F59E0B' },
    ratingLabel: { textAlign: 'center', fontSize: 15, color: '#6B7280', marginBottom: 20, fontStyle: 'italic' },
    tagsTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 },
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
    tagActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    tagText: { fontSize: 13, color: '#374151' },
    tagTextActive: { color: '#fff' },
    commentLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    textarea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, backgroundColor: '#fff', fontSize: 14, minHeight: 100 },
    submitBtn: { marginTop: 24, backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    skipBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
    skipBtnText: { fontSize: 14, color: '#9CA3AF' },
});

export default TaxiRatingScreen;
