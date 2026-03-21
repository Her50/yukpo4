import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../services/api';
import UserMentionPicker from './UserMentionPicker';

export interface GlobalSharePayload {
  title: string;
  description?: string;
  shareUrl: string;
  contentType: 'product' | 'video' | 'menu' | 'health_stats' | 'navigation_stats';
  serviceId?: number | null;
  productIndex?: number | null;
  extraData?: Record<string, any>;
}

interface GlobalShareModalProps {
  visible: boolean;
  onClose: () => void;
  payload: GlobalSharePayload | null;
}

const GlobalShareModal: React.FC<GlobalShareModalProps> = ({ visible, onClose, payload }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [sendingInternal, setSendingInternal] = useState(false);
  const [showYukpoOption, setShowYukpoOption] = useState(false);
  const nativeShareTriggered = useRef(false);

  const shareText = useMemo(() => {
    if (!payload) return '';
    let text = `🎬 ${payload.title}`;
    if (payload.description) text += `\n\n${payload.description}`;
    text += `\n\n🔗 Voir sur Yukpo:\n${payload.shareUrl}`;
    return text;
  }, [payload]);

  useEffect(() => {
    if (visible && payload && !nativeShareTriggered.current) {
      nativeShareTriggered.current = true;
      triggerNativeShare();
    }
    if (!visible) {
      nativeShareTriggered.current = false;
      setShowYukpoOption(false);
    }
  }, [visible, payload]);

  const triggerNativeShare = async () => {
    if (!payload) return;
    try {
      await Share.share({
        message: shareText,
        title: payload.title,
        url: payload.shareUrl,
      });
    } catch (e) {
      console.log('[GlobalShareModal] Native share dismissed or error');
    }
    setShowYukpoOption(true);
  };

  const handleReshare = async () => {
    nativeShareTriggered.current = false;
    setShowYukpoOption(false);
    setTimeout(() => {
      nativeShareTriggered.current = true;
      triggerNativeShare();
    }, 100);
  };

  const handleSelectUser = async (user: any) => {
    if (!payload || !user?.id) return;
    setSendingInternal(true);
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
          share_url: payload.shareUrl,
          ...payload.extraData,
        },
      });
      if (response.success) {
        Alert.alert('Envoyé', `Partagé avec ${user.nom_complet || 'utilisateur'}`);
      } else {
        Alert.alert('Erreur', (response as any)?.error || 'Echec du partage interne');
      }
    } catch {
      Alert.alert('Erreur', 'Partage interne impossible');
    } finally {
      setSendingInternal(false);
      setShowPicker(false);
      onClose();
    }
  };

  const handleClose = () => {
    setShowYukpoOption(false);
    setShowPicker(false);
    onClose();
  };

  if (!visible || !payload) return null;

  if (!showYukpoOption) return null;

  return (
    <>
      <Modal visible={showYukpoOption} transparent animationType="slide" onRequestClose={handleClose}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View style={styles.bottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.title}>Partager sur Yukpo</Text>

            <TouchableOpacity
              style={styles.yukpoRow}
              onPress={() => setShowPicker(true)}
              disabled={sendingInternal}
              activeOpacity={0.7}
            >
              <View style={styles.yukpoIcon}>
                <Text style={styles.yukpoIconText}>YP</Text>
              </View>
              <View style={styles.yukpoTextContainer}>
                <Text style={styles.yukpoLabel}>Yukpo</Text>
                <Text style={styles.yukpoSub}>Envoyer à un ami dans l'app</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.reshareRow}
              onPress={handleReshare}
              activeOpacity={0.7}
            >
              <Text style={styles.reshareIcon}>📤</Text>
              <Text style={styles.reshareLabel}>Autres applications...</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <UserMentionPicker
        visible={showPicker}
        onSelectUser={handleSelectUser}
        onClose={() => setShowPicker(false)}
        currentQuery=""
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4B5563',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  yukpoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 14,
    padding: 14,
  },
  yukpoIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yukpoIconText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  yukpoTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  yukpoLabel: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
  },
  yukpoSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 12,
  },
  reshareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  reshareIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  reshareLabel: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default GlobalShareModal;
