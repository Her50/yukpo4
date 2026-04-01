/**
 * ServiceCardActions — Barre d'actions réutilisable pour toutes les cartes de services spécialisés
 * Intègre : partage externe, commentaires/avis, réactions et chat mobile
 *
 * Utilisation:
 *   <ServiceCardActions
 *     serviceId={service.service_id}
 *     serviceTitle="Taxi Dupont"
 *     serviceType="taxi"
 *     user={user}
 *   />
 */

import React, { useState } from 'react';
import {
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import ChatModalMobile from '../ChatModalMobile';
import GlobalShareModal, { GlobalSharePayload } from '../GlobalShareModal';
import ProductCommentsSection from '../ProductCommentsSection';
import SafeIcon from '../SafeIcon';

interface ServiceCardActionsProps {
    /** ID de la fiche service (service.service_id ou service.id selon la carte) */
    serviceId: number;
    /** Nom/titre affiché dans le modal de partage */
    serviceTitle: string;
    /** Type de service : 'taxi' | 'pharmacie' | 'hopital' | 'labo' | 'sang' | 'covoiturage' | 'immobilier' | 'agence' | ... */
    serviceType: string;
    /** Description courte pour le texte de partage (optionnel) */
    serviceDescription?: string;
    /** Numéro WhatsApp du prestataire (prioritaire sur prestataireInfo.whatsapp) */
    whatsapp?: string;
    /** Infos propriétaire / prestataire pour ChatModalMobile */
    prestataireInfo?: any;
    /** Styles supplémentaires pour le conteneur d'actions */
    containerStyle?: any;
}

const APP_BASE_URL = 'https://yukpomnang.com';

const REACTION_ICONS: Record<string, string> = {
    taxi: '🚕',
    pharmacie: '💊',
    hopital: '🏥',
    labo: '🔬',
    laboratoire: '🔬',
    sang: '🩸',
    covoiturage: '🚗',
    immobilier: '🏠',
    agence: '✈️',
    agence_voyage: '✈️',
    demenagement: '📦',
    decoration: '🎨',
    default: '⭐',
};

const ServiceCardActions: React.FC<ServiceCardActionsProps> = ({
    serviceId,
    serviceTitle,
    serviceType,
    serviceDescription,
    whatsapp,
    prestataireInfo,
    containerStyle,
}) => {
    const { user } = useAuth();

    // ── États modaux ─────────────────────────────────────────────────────────
    const [shareVisible, setShareVisible] = useState(false);
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [chatVisible, setChatVisible] = useState(false);

    // ── Payload de partage ───────────────────────────────────────────────────
    const sharePayload: GlobalSharePayload = {
        title: serviceTitle,
        description: serviceDescription,
        shareUrl: `${APP_BASE_URL}/services/${serviceType}/${serviceId}`,
        contentType: 'product', // type générique supporté par GlobalShareModal
        serviceId,
    };

    // ── Objet service minimal pour ChatModalMobile ───────────────────────────
    const serviceForChat = {
        id: serviceId,
        service_id: serviceId,
        title: serviceTitle,
        type: serviceType,
        nom: serviceTitle,
    };

    const icon = REACTION_ICONS[serviceType] || REACTION_ICONS.default;

    return (
        <>
            {/* ── Barre d'actions ─────────────────────────────────────────── */}
            <View style={[styles.container, containerStyle]}>
                {/* Partager */}
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setShareVisible(true)}
                    accessibilityLabel="Partager ce service"
                >
                    <SafeIcon name="share-2" size={17} color="#6B7280" />
                    <Text style={styles.actionLabel}>Partager</Text>
                </TouchableOpacity>

                {/* Séparateur */}
                <View style={styles.separator} />

                {/* Avis & Réactions */}
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setCommentsVisible(true)}
                    accessibilityLabel="Voir les avis et réagir"
                >
                    <SafeIcon name="message-square" size={17} color="#6B7280" />
                    <Text style={styles.actionLabel}>Avis</Text>
                </TouchableOpacity>

                {/* Séparateur */}
                <View style={styles.separator} />

                {/* Chat avec le prestataire */}
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setChatVisible(true)}
                    accessibilityLabel="Contacter via chat"
                >
                    <SafeIcon name="message-circle" size={17} color="#3B82F6" />
                    <Text style={[styles.actionLabel, { color: '#3B82F6' }]}>Chat</Text>
                </TouchableOpacity>
            </View>

            {/* ── Modal Partage (GlobalShareModal) ────────────────────────── */}
            <GlobalShareModal
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                payload={sharePayload}
            />

            {/* ── Modal Avis / Commentaires / Réactions ───────────────────── */}
            <Modal
                visible={commentsVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setCommentsVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    {/* En-tête du modal */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {icon} {serviceTitle}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setCommentsVisible(false)}
                            style={styles.closeBtn}
                        >
                            <SafeIcon name="x" size={22} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    {/* Section commentaires + réactions (ProductCommentsSection gère les deux) */}
                    <ProductCommentsSection
                        serviceId={serviceId}
                        serviceTitle={serviceTitle}
                        mode="full"
                        onOpenChat={(userId, userName, userAvatar) => {
                            setCommentsVisible(false);
                            // Ouvre le chat avec cet utilisateur spécifique
                            setChatVisible(true);
                        }}
                    />
                </SafeAreaView>
            </Modal>

            {/* ── Chat Mobile (ChatModalMobile) ───────────────────────────── */}
            <ChatModalMobile
                visible={chatVisible}
                onClose={() => setChatVisible(false)}
                service={serviceForChat}
                prestataireInfo={
                    {
                        id: serviceId,
                        nom: serviceTitle,
                        type: serviceType,
                        whatsapp: whatsapp || prestataireInfo?.whatsapp,
                        telephone: prestataireInfo?.telephone,
                        ...prestataireInfo,
                        // whatsapp prop takes precedence over prestataireInfo.whatsapp
                        ...(whatsapp ? { whatsapp } : {}),
                    }
                }
                user={user}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        marginTop: 8,
    },
    actionBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 5,
        paddingVertical: 4,
    },
    actionLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    separator: {
        width: 1,
        height: 20,
        backgroundColor: '#E5E7EB',
    },
    // ─── Modal avis ──────────────────────────────────────────────────────────
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
        marginRight: 8,
    },
    closeBtn: {
        padding: 4,
    },
});

export default ServiceCardActions;
