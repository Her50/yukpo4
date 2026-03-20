import React, { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  const shareText = useMemo(() => {
    if (!payload) return '';
    let text = `🎬 ${payload.title}`;
    if (payload.description) text += `\n\n${payload.description}`;
    text += `\n\n🔗 Voir sur Yukpo:\n${payload.shareUrl}`;
    return text;
  }, [payload]);

  const handleExternalShare = async (platform: 'whatsapp' | 'facebook' | 'telegram' | 'email' | 'native') => {
    if (!payload) return;
    try {
      if (platform === 'native') {
        await Share.share({ message: shareText, title: payload.title, url: payload.shareUrl });
        return;
      }

      let url = '';
      if (platform === 'whatsapp') url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      if (platform === 'facebook') url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.shareUrl)}`;
      if (platform === 'telegram') url = `https://t.me/share/url?url=${encodeURIComponent(payload.shareUrl)}&text=${encodeURIComponent(payload.title)}`;
      if (platform === 'email') url = `mailto:?subject=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(shareText)}`;

      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert('Erreur', 'Application de partage indisponible');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Erreur', 'Partage impossible');
    }
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

  if (!visible || !payload) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Partager</Text>
            <TouchableOpacity style={[styles.btn, styles.yukpoTop]} onPress={() => setShowPicker(true)} disabled={sendingInternal}>
              <Text style={styles.btnText}>Yukpo</Text>
            </TouchableOpacity>
            <View style={styles.grid}>
              <TouchableOpacity style={[styles.btn, styles.whatsapp]} onPress={() => handleExternalShare('whatsapp')}>
                <Text style={styles.btnText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.facebook]} onPress={() => handleExternalShare('facebook')}>
                <Text style={styles.btnText}>Facebook</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.telegram]} onPress={() => handleExternalShare('telegram')}>
                <Text style={styles.btnText}>Telegram</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.email]} onPress={() => handleExternalShare('email')}>
                <Text style={styles.btnText}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.more]} onPress={() => handleExternalShare('native')}>
                <Text style={styles.btnText}>Plus...</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.close} onPress={onClose}>
              <Text style={styles.closeText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#111827', borderRadius: 16, padding: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  yukpoTop: { width: '100%', marginBottom: 8, backgroundColor: '#7C3AED' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { width: '31%', minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  whatsapp: { backgroundColor: '#25D366' },
  facebook: { backgroundColor: '#1877F2' },
  telegram: { backgroundColor: '#0088CC' },
  email: { backgroundColor: '#6B7280' },
  more: { backgroundColor: '#374151' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  close: { marginTop: 12, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 10 },
  closeText: { color: '#E5E7EB', fontWeight: '600' },
});

export default GlobalShareModal;

