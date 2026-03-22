import React, { useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../services/api';
import UserMentionPicker from './UserMentionPicker';

export interface GlobalSharePayload {
  title: string;
  description?: string;
  shareUrl: string;
  contentType: 'product' | 'video' | 'menu' | 'health_stats' | 'navigation_stats' | 'chat_message';
  serviceId?: number | null;
  productIndex?: number | null;
  extraData?: Record<string, any>;
}

interface GlobalShareModalProps {
  visible: boolean;
  onClose: () => void;
  payload: GlobalSharePayload | null;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const YUKPO_ICON = require('../../assets/icon.png');

const PLATFORMS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬', bg: '#25D366', scheme: (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}` },
  { key: 'facebook', label: 'Facebook', icon: 'f', bg: '#1877F2', scheme: (text: string, url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}` },
  { key: 'telegram', label: 'Telegram', icon: '✈️', bg: '#0088CC', scheme: (text: string, url: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { key: 'twitter', label: 'Twitter/X', icon: '𝕏', bg: '#111827', scheme: (text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` },
  { key: 'email', label: 'Email', icon: '✉️', bg: '#6B7280', scheme: (text: string, _url: string, title: string) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}` },
  { key: 'copy', label: 'Copier', icon: '🔗', bg: '#4B5563', scheme: null },
] as const;

const GlobalShareModal: React.FC<GlobalShareModalProps> = ({ visible, onClose, payload }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [sendingInternal, setSendingInternal] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const shareText = useMemo(() => {
    if (!payload) return '';
    let text = payload.title;
    if (payload.description) text += `\n\n${payload.description}`;
    text += `\n\n${payload.shareUrl}`;
    if (payload.contentType === 'chat_message') {
      text += '\n\n—\nRéponse générée par Yukpo IA · https://yukpomnang.com';
    }
    return text;
  }, [payload]);

  const handlePlatformShare = async (key: string) => {
    if (!payload) return;
    if (key === 'copy') {
      try {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(shareText);
        setCopiedFeedback(true);
        setTimeout(() => setCopiedFeedback(false), 2000);
      } catch { Alert.alert('Erreur', 'Copie impossible'); }
      return;
    }
    const platform = PLATFORMS.find(p => p.key === key);
    if (!platform?.scheme) return;
    const url = platform.scheme(shareText, payload.shareUrl, payload.title);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) { await Linking.openURL(url); }
      else { Alert.alert('Non disponible', `${platform.label} n'est pas installé sur cet appareil`); }
    } catch { Alert.alert('Erreur', `Impossible d'ouvrir ${platform.label}`); }
  };

  const handleNativeShare = async () => {
    if (!payload) return;
    try {
      await Share.share({
        message: shareText,
        title: payload.title,
        ...(Platform.OS === 'ios' ? { url: payload.shareUrl } : {}),
      });
    } catch { }
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
        Alert.alert('Envoyé !', `Partagé avec ${user.nom_complet || 'utilisateur'}`);
      } else {
        Alert.alert('Erreur', (response as any)?.error || 'Échec du partage interne');
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
    setShowPicker(false);
    setCopiedFeedback(false);
    onClose();
  };

  if (!visible || !payload) return null;

  return (
    <>
      <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
        <Pressable style={s.overlay} onPress={handleClose}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.handle} />
            <Text style={s.title}>Partager</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row} style={s.scrollRow}>
              {/* Yukpo — first position */}
              <TouchableOpacity
                style={s.appItem}
                onPress={() => setShowPicker(true)}
                disabled={sendingInternal}
                activeOpacity={0.7}
              >
                <Image source={YUKPO_ICON} style={s.appIconImage} />
                <Text style={s.appLabel} numberOfLines={1}>Yukpo</Text>
              </TouchableOpacity>

              {/* Platform targets */}
              {PLATFORMS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={s.appItem}
                  onPress={() => handlePlatformShare(p.key)}
                  activeOpacity={0.7}
                >
                  <View style={[s.appIcon, { backgroundColor: p.bg }]}>
                    {p.key === 'copy' && copiedFeedback
                      ? <Text style={s.appIconText}>✓</Text>
                      : <Text style={[s.appIconText, p.key === 'facebook' && s.fbText]}>{p.icon}</Text>}
                  </View>
                  <Text style={s.appLabel} numberOfLines={1}>
                    {p.key === 'copy' && copiedFeedback ? 'Copié !' : p.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Plus... → native share sheet */}
              <TouchableOpacity style={s.appItem} onPress={handleNativeShare} activeOpacity={0.7}>
                <View style={[s.appIcon, { backgroundColor: '#6366F1' }]}>
                  <Text style={s.appIconText}>⋯</Text>
                </View>
                <Text style={s.appLabel} numberOfLines={1}>Plus</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={s.closeBtnText}>Fermer</Text>
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

const ICON_SIZE = 54;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 34,
    paddingTop: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#4B5563',
    alignSelf: 'center', marginBottom: 14,
  },
  title: {
    color: '#F9FAFB', fontSize: 16, fontWeight: '700',
    marginBottom: 16, marginLeft: 4,
  },
  scrollRow: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 2,
  },
  appItem: {
    alignItems: 'center',
    width: ICON_SIZE + 12,
  },
  appIcon: {
    width: ICON_SIZE, height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  appIconImage: {
    width: ICON_SIZE, height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
  },
  appIconText: {
    color: '#fff', fontSize: 22,
  },
  fbText: {
    fontWeight: '800', fontSize: 24,
  },
  appLabel: {
    color: '#D1D5DB', fontSize: 11, marginTop: 6,
    textAlign: 'center',
  },
  closeBtn: {
    alignSelf: 'center',
    paddingVertical: 10, paddingHorizontal: 24,
  },
  closeBtnText: {
    color: '#9CA3AF', fontSize: 14, fontWeight: '600',
  },
});

export default GlobalShareModal;
