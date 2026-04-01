import React, { useState } from 'react';
import {
    Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, Switch, ActivityIndicator, Alert,
} from 'react-native';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

export type ServiceType = 'bus' | 'covoiturage' | 'taxi';

interface Formule {
    id: string;
    nom: string;
    prix: number;
    couverture: string[];
    plafond: string;
    couleur: string;
    recommended?: boolean;
}

const FORMULES: Formule[] = [
    {
        id: 'basique',
        nom: 'Basique',
        prix: 500,
        couverture: ['Annulation simple', 'Bagages perdus (50 000 FCFA max)'],
        plafond: '50 000 FCFA',
        couleur: '#6B7280',
    },
    {
        id: 'confort',
        nom: 'Confort',
        prix: 1200,
        couverture: [
            'Annulation toutes causes',
            'Bagages (200 000 FCFA max)',
            'Accident corporel',
            'Assistance rapatriement',
        ],
        plafond: '500 000 FCFA',
        couleur: modernColors.primary,
        recommended: true,
    },
    {
        id: 'premium',
        nom: 'Premium',
        prix: 2500,
        couverture: [
            'Annulation toutes causes',
            'Bagages (500 000 FCFA max)',
            'Accident corporel + hospitalisation',
            'Assistance rapatriement',
            'Responsabilité civile',
            'Retard de correspondance',
        ],
        plafond: '5 000 000 FCFA',
        couleur: '#7C3AED',
    },
];

interface Props {
    visible: boolean;
    onClose: () => void;
    onConfirm: (formuleId: string | null, prix: number) => void;
    serviceType: ServiceType;
    trajet?: string;
    dateDepart?: string;
    montantBillet?: number;
    bookingRef?: string;
}

const AssuranceVoyageModal: React.FC<Props> = ({
    visible, onClose, onConfirm, serviceType, trajet, dateDepart, montantBillet, bookingRef,
}) => {
    const [selected, setSelected] = useState<string | null>('confort');
    const [skiped, setSkiped] = useState(false);
    const [adding, setAdding] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);

    const selectedFormule = FORMULES.find(f => f.id === selected);

    const handleConfirm = async () => {
        if (skiped) { onConfirm(null, 0); return; }
        if (!selected) { Alert.alert('Sélection requise', 'Choisissez une formule ou ignorez.'); return; }

        setAdding(true);
        try {
            await apiPost('/api/assurance/voyage', {
                formule_id: selected,
                service_type: serviceType,
                booking_ref: bookingRef,
                trajet,
                date_depart: dateDepart,
                montant_billet: montantBillet,
            });
        } catch { /* best effort — ne bloque pas le booking */ }
        finally { setAdding(false); }

        onConfirm(selected, selectedFormule?.prix || 0);
    };

    const serviceLabel = serviceType === 'bus' ? 'bus' : serviceType === 'covoiturage' ? 'covoiturage' : 'taxi';

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Text style={styles.title}>Protégez votre voyage</Text>
                            <Text style={styles.subtitle}>Assurance {serviceLabel} — optionnelle</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <SafeIcon name="x" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Context */}
                    {trajet && (
                        <View style={styles.contextCard}>
                            <SafeIcon name="map-pin" size={14} color="#6B7280" />
                            <Text style={styles.contextText} numberOfLines={1}>{trajet}</Text>
                            {dateDepart && <Text style={styles.contextDate}>{new Date(dateDepart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text>}
                        </View>
                    )}

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        {/* Formules */}
                        {FORMULES.map(f => {
                            const isSelected = selected === f.id && !skiped;
                            const isExpanded = expanded === f.id;

                            return (
                                <TouchableOpacity
                                    key={f.id}
                                    style={[styles.formuleCard, isSelected && { borderColor: f.couleur, borderWidth: 2 }]}
                                    onPress={() => { setSelected(f.id); setSkiped(false); }}
                                    activeOpacity={0.85}
                                >
                                    {f.recommended && (
                                        <View style={[styles.recommendedBadge, { backgroundColor: f.couleur }]}>
                                            <Text style={styles.recommendedText}>⭐ Recommandé</Text>
                                        </View>
                                    )}

                                    <View style={styles.formuleHeader}>
                                        <View style={styles.formuleLeft}>
                                            <View style={[styles.radioBtn, isSelected && { borderColor: f.couleur }]}>
                                                {isSelected && <View style={[styles.radioDot, { backgroundColor: f.couleur }]} />}
                                            </View>
                                            <View>
                                                <Text style={[styles.formuleNom, isSelected && { color: f.couleur }]}>{f.nom}</Text>
                                                <Text style={styles.formulePlafond}>Jusqu'à {f.plafond}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.formuleRight}>
                                            <Text style={[styles.formulePrix, { color: f.couleur }]}>+{f.prix.toLocaleString()}</Text>
                                            <Text style={styles.formulePrixUnit}>FCFA</Text>
                                        </View>
                                    </View>

                                    {/* Preview of first 2 items */}
                                    <View style={styles.coveragePreview}>
                                        {f.couverture.slice(0, isExpanded ? f.couverture.length : 2).map((c, i) => (
                                            <View key={i} style={styles.coverageRow}>
                                                <SafeIcon name="check" size={13} color={f.couleur} />
                                                <Text style={styles.coverageText}>{c}</Text>
                                            </View>
                                        ))}
                                        {f.couverture.length > 2 && (
                                            <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : f.id)}>
                                                <Text style={[styles.expandLink, { color: f.couleur }]}>
                                                    {isExpanded ? 'Voir moins' : `+${f.couverture.length - 2} garanties`}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {/* Skip option */}
                        <TouchableOpacity style={[styles.skipCard, skiped && styles.skipCardActive]} onPress={() => { setSkiped(s => !s); if (!skiped) setSelected(null); }}>
                            <View style={styles.skipLeft}>
                                <View style={[styles.radioBtn, skiped && { borderColor: '#DC2626' }]}>
                                    {skiped && <View style={[styles.radioDot, { backgroundColor: '#DC2626' }]} />}
                                </View>
                                <View>
                                    <Text style={styles.skipLabel}>Non merci, voyager sans assurance</Text>
                                    <Text style={styles.skipSub}>En cas d'annulation, aucun remboursement</Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Summary */}
                        {!skiped && selectedFormule && (
                            <View style={[styles.summaryCard, { borderColor: selectedFormule.couleur }]}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryKey}>Formule choisie</Text>
                                    <Text style={[styles.summaryVal, { color: selectedFormule.couleur }]}>{selectedFormule.nom}</Text>
                                </View>
                                {montantBillet && (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryKey}>Billet</Text>
                                        <Text style={styles.summaryVal}>{montantBillet.toLocaleString()} FCFA</Text>
                                    </View>
                                )}
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryKey}>Assurance</Text>
                                    <Text style={[styles.summaryVal, { color: selectedFormule.couleur }]}>+{selectedFormule.prix.toLocaleString()} FCFA</Text>
                                </View>
                                {montantBillet && (
                                    <View style={[styles.summaryRow, styles.totalRow]}>
                                        <Text style={styles.totalKey}>Total</Text>
                                        <Text style={styles.totalVal}>{(montantBillet + selectedFormule.prix).toLocaleString()} FCFA</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    {/* CTA */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[
                                styles.confirmBtn,
                                adding && styles.confirmBtnDisabled,
                                !skiped && selectedFormule ? { backgroundColor: selectedFormule.couleur } : styles.skipConfirmBtn,
                            ]}
                            onPress={handleConfirm}
                            disabled={adding}
                        >
                            {adding
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <SafeIcon name={skiped ? 'arrow-right' : 'shield'} size={20} color="#fff" />
                            }
                            <Text style={styles.confirmBtnText}>
                                {skiped
                                    ? 'Continuer sans assurance'
                                    : selectedFormule
                                    ? `Ajouter ${selectedFormule.nom} — ${selectedFormule.prix.toLocaleString()} FCFA`
                                    : 'Choisissez une formule'
                                }
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.footerNote}>Fourni par Yukpo Assurance Partenaire · Remboursement sous 5 jours ouvrés</Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
    handle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 12 },
    headerLeft: {},
    title: { fontSize: 20, fontWeight: '800', color: '#111827' },
    subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
    closeBtn: { padding: 4 },
    contextCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', marginHorizontal: 20, borderRadius: 8, padding: 10, marginBottom: 4 },
    contextText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
    contextDate: { fontSize: 12, color: '#9CA3AF' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    formuleCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
    recommendedBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 12 },
    recommendedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    formuleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    formuleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    radioBtn: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
    radioDot: { width: 11, height: 11, borderRadius: 6 },
    formuleNom: { fontSize: 16, fontWeight: '800', color: '#111827' },
    formulePlafond: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
    formuleRight: { alignItems: 'flex-end' },
    formulePrix: { fontSize: 22, fontWeight: '900' },
    formulePrixUnit: { fontSize: 11, color: '#9CA3AF', marginTop: -3 },
    coveragePreview: { gap: 6 },
    coverageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    coverageText: { fontSize: 13, color: '#374151' },
    expandLink: { fontSize: 12, fontWeight: '700', marginTop: 4 },
    skipCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    skipCardActive: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
    skipLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    skipLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
    skipSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    summaryCard: { borderRadius: 12, padding: 14, borderWidth: 2, marginBottom: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    summaryKey: { fontSize: 13, color: '#6B7280' },
    summaryVal: { fontSize: 13, fontWeight: '700', color: '#111827' },
    totalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 6, paddingTop: 10 },
    totalKey: { fontSize: 15, fontWeight: '800', color: '#111827' },
    totalVal: { fontSize: 18, fontWeight: '900', color: '#111827' },
    footer: { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, marginBottom: 8 },
    confirmBtnDisabled: { opacity: 0.6 },
    skipConfirmBtn: { backgroundColor: '#6B7280' },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    footerNote: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
});

export default AssuranceVoyageModal;
