/**
 * InternalShareButton - Bouton réutilisable pour le partage interne entre utilisateurs
 * Supporte: product, video, menu, health_stats, navigation_stats
 * Date: 2026-03-14
 */

import React, { useCallback, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../services/api';
import SafeIcon from './SafeIcon';
import UserMentionPicker from './UserMentionPicker';

export type InternalShareContentType = 'product' | 'video' | 'menu' | 'health_stats' | 'navigation_stats';

export interface InternalSharePayload {
  /** Type de contenu partagé */
  contentType: InternalShareContentType;
  /** service_id si applicable (product, video) */
  serviceId?: number | null;
  /** product_index si applicable */
  productIndex?: number | null;
  /** Titre du contenu partagé */
  title: string;
  /** Description optionnelle */
  description?: string;
  /** URL ou données supplémentaires */
  extraData?: Record<string, any>;
}

interface InternalShareButtonProps {
  /** Données du contenu à partager */
  payload: InternalSharePayload;
  /** Taille de l'icône (default: 14) */
  iconSize?: number;
  /** Couleur de l'icône (default: #6B7280) */
  iconColor?: string;
  /** Style du bouton */
  style?: any;
  /** Afficher le label "Envoyer" à côté de l'icône */
  showLabel?: boolean;
  /** Label personnalisé */
  label?: string;
  /** Callback après partage réussi */
  onShareSuccess?: () => void;
}

const InternalShareButton: React.FC<InternalShareButtonProps> = ({
  payload,
  iconSize = 14,
  iconColor = '#6B7280',
  style,
  showLabel = false,
  label = 'Envoyer',
  onShareSuccess,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSelectUser = useCallback(async (user: any) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const response = await apiPost('/api/products/share-internal', {
        service_id: payload.serviceId ?? null,
        product_index: payload.productIndex ?? null,
        recipient_ids: [user.id],
        message: '',
        content_type: payload.contentType,
        content_data: {
          title: payload.title,
          description: payload.description || '',
          ...payload.extraData,
        },
      });

      if (response.success) {
        Alert.alert('Envoyé !', `${payload.title} partagé avec ${user.nom_complet || 'l\'utilisateur'}`);
        onShareSuccess?.();
      } else {
        Alert.alert('Erreur', (response as any).error || 'Échec du partage');
      }
    } catch (error) {
      console.error('[InternalShareButton] Erreur:', error);
      Alert.alert('Erreur', 'Impossible de partager en interne');
    } finally {
      setLoading(false);
      setShowPicker(false);
    }
  }, [payload, onShareSuccess]);

  return (
    <>
      <TouchableOpacity
        style={[{ flexDirection: 'row', alignItems: 'center', padding: 4 }, style]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
        disabled={loading}
      >
        <SafeIcon name="send" size={iconSize} color={iconColor} />
        {showLabel && (
          <Text style={{ marginLeft: 4, fontSize: 12, color: iconColor }}>{label}</Text>
        )}
      </TouchableOpacity>

      <UserMentionPicker
        visible={showPicker}
        onSelectUser={handleSelectUser}
        onClose={() => setShowPicker(false)}
        currentQuery=""
      />
    </>
  );
};

export default React.memo(InternalShareButton);
