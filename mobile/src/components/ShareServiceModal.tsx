import * as Clipboard from 'expo-clipboard';
import { Copy, Facebook, Link as LinkIcon, Mail, MessageCircle, Share2, Twitter, X } from 'lucide-react-native';
import React from 'react';
import { Alert, Linking, Modal, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ShareServiceModalProps {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  titre?: string;
  description?: string;
  prix?: string | number;
  devise?: string;
}

// ✅ CORRIGÉ: Utiliser l'URL du backend Cloud Run qui sert la route /service/:id
const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_URL || 'https://yukpomnang.com';
const getServiceUrl = (serviceId: string) => `${SHARE_BASE_URL}/service/${serviceId}`;

const ShareServiceModal: React.FC<ShareServiceModalProps> = ({ open, onClose, serviceId, titre, description, prix, devise }) => {
  const url = getServiceUrl(serviceId);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert("✅ Lien copié !", "Le lien a été copié dans votre presse-papiers");
    } catch (error) {
      console.error('Erreur copie:', error);
      Alert.alert("Erreur", "Impossible de copier le lien");
    }
  };

  const handleShare = async (platform: 'whatsapp' | 'facebook' | 'twitter' | 'email' | 'linkedin' | 'telegram') => {
    let shareUrl = '';
    const serviceTitle = titre || 'Service Yukpo';
    const deviseStr = devise || 'XAF';
    let serviceDescription = `🛍️ ${serviceTitle}`;
    if (description) serviceDescription += `\n\n${description}`;
    if (prix) serviceDescription += `\n💰 Prix: ${prix} ${deviseStr}`;
    serviceDescription += `\n\n🔗 Voir sur Yukpo:`;
    const fullText = `${serviceDescription}\n${url}`;

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(serviceDescription)}`;
        break;
      case 'twitter':
        const twitterText = `${serviceDescription}\n\n#Yukpo #Services #Cameroun\n\n${url}`;
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(serviceDescription)}`;
        break;
      case 'email':
        const emailSubject = `Service Yukpo : ${serviceTitle}`;
        const emailBody = `Bonjour,\n\nJe vous partage ce service intéressant sur Yukpo :\n\n${serviceTitle}${description ? '\n' + description : ''}${prix ? '\n\nPrix: ' + prix + ' ' + (devise || 'XAF') : ''}\n\n${url}\n\nCordialement`;
        shareUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        break;
    }

    try {
      const supported = await Linking.canOpenURL(shareUrl);
      if (supported) {
        await Linking.openURL(shareUrl);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir cette application');
      }
    } catch (error) {
      console.error('Erreur ouverture URL:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir cette application');
    }
  };

  const handleNativeShare = async () => {
    try {
      const serviceTitle = titre || 'Service Yukpo';
      const deviseStr = devise || 'XAF';
      let shareText = `🛍️ ${serviceTitle}`;
      if (description) shareText += `\n\n${description}`;
      if (prix) shareText += `\n💰 Prix: ${prix} ${deviseStr}`;
      shareText += `\n\n🔗 Voir sur Yukpo:\n${url}`;
      const result = await Share.share({
        message: shareText,
        title: serviceTitle,
        url: url,
      });
    } catch (error) {
      console.error('Erreur partage natif:', error);
      // Fallback vers la copie
      handleCopy();
    }
  };

  if (!open) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Share2 size={20} color="#2563EB" />
              <Text style={styles.headerTitle}>Partager ce service</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* URL Field */}
            <View style={styles.urlSection}>
              <Text style={styles.label}>Lien du service</Text>
              <View style={styles.urlContainer}>
                <TextInput
                  style={styles.urlInput}
                  value={url}
                  editable={false}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopy}
                >
                  <Copy size={16} color="#2563EB" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Share Options */}
            <View style={styles.shareSection}>
              <Text style={styles.shareTitle}>Partager sur</Text>
              <View style={styles.shareGrid}>
                <TouchableOpacity
                  style={[styles.shareButton, styles.whatsappButton]}
                  onPress={() => handleShare('whatsapp')}
                >
                  <MessageCircle size={16} color="white" />
                  <Text style={styles.shareButtonText}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareButton, styles.facebookButton]}
                  onPress={() => handleShare('facebook')}
                >
                  <Facebook size={16} color="white" />
                  <Text style={styles.shareButtonText}>Facebook</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareButton, styles.twitterButton]}
                  onPress={() => handleShare('twitter')}
                >
                  <Twitter size={16} color="white" />
                  <Text style={styles.shareButtonText}>Twitter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareButton, styles.linkedinButton]}
                  onPress={() => handleShare('linkedin')}
                >
                  <Text style={styles.shareButtonText}>LinkedIn</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareButton, styles.telegramButton]}
                  onPress={() => handleShare('telegram')}
                >
                  <Text style={styles.shareButtonText}>Telegram</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareButton, styles.emailButton]}
                  onPress={() => handleShare('email')}
                >
                  <Mail size={16} color="white" />
                  <Text style={styles.shareButtonText}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Native Share */}
            <View style={styles.nativeShareSection}>
              <TouchableOpacity
                style={styles.nativeShareButton}
                onPress={handleNativeShare}
              >
                <LinkIcon size={16} color="white" />
                <Text style={styles.nativeShareButtonText}>Partage natif</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 448,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
    borderRadius: 999,
  },
  content: {
    padding: 24,
    gap: 24,
  },
  urlSection: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
  },
  copyButton: {
    padding: 8,
  },
  shareSection: {
    gap: 12,
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shareButton: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
  },
  twitterButton: {
    backgroundColor: '#1DA1F2',
  },
  linkedinButton: {
    backgroundColor: '#0A66C2',
  },
  telegramButton: {
    backgroundColor: '#0088CC',
  },
  emailButton: {
    backgroundColor: '#6B7280',
  },
  shareButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  nativeShareSection: {
    paddingTop: 8,
  },
  nativeShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#6366F1',
  },
  nativeShareButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ShareServiceModal;
