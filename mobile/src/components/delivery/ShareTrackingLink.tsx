/**
 * 🔗 Partage social du lien de tracking
 * Design moderne avec options multiples
 */

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { NativeCard } from '../SafeNativeDesign';
import { SafeIcon } from '../SafeIcon';

interface ShareTrackingLinkProps {
    deliveryId: string;
    deliveryTitle?: string;
    onShare?: () => void;
    style?: any;
}

const ShareTrackingLink: React.FC<ShareTrackingLinkProps> = ({
    deliveryId,
    deliveryTitle = 'Ma livraison',
    onShare,
    style,
}) => {
    const [copied, setCopied] = useState(false);

    const trackingUrl = `https://yukpomnang.com/track/${deliveryId}`;
    const shareMessage = `Suivez ma livraison en temps réel : ${trackingUrl}`;

    const handleCopyLink = async () => {
        try {
            await Clipboard.setStringAsync(trackingUrl);
            setCopied(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de copier le lien');
        }
    };

    const handleShare = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await Share.share({
                message: shareMessage,
                title: deliveryTitle,
            });
            if (result.action === Share.sharedAction) {
                onShare?.();
            }
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de partager');
        }
    };

    const shareOptions = [
        {
            id: 'whatsapp',
            name: 'WhatsApp',
            icon: 'message-circle',
            color: '#25D366',
            onPress: async () => {
                const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
                try {
                    await Linking.openURL(whatsappUrl);
                } catch {
                    Alert.alert('WhatsApp non installé', 'Veuillez installer WhatsApp');
                }
            },
        },
        {
            id: 'sms',
            name: 'SMS',
            icon: 'message-square',
            color: modernColors.primary,
            onPress: async () => {
                const smsUrl = `sms:?body=${encodeURIComponent(shareMessage)}`;
                try {
                    await Linking.openURL(smsUrl);
                } catch {
                    Alert.alert('Erreur', 'Impossible d\'envoyer un SMS');
                }
            },
        },
        {
            id: 'email',
            name: 'Email',
            icon: 'mail',
            color: modernColors.info,
            onPress: async () => {
                const emailUrl = `mailto:?subject=${encodeURIComponent(deliveryTitle)}&body=${encodeURIComponent(shareMessage)}`;
                try {
                    await Linking.openURL(emailUrl);
                } catch {
                    Alert.alert('Erreur', 'Impossible d\'envoyer un email');
                }
            },
        },
    ];

    return (
        <NativeCard style={[styles.container, style]}>
            <View style={styles.header}>
                <SafeIcon name="share-2" size={20} color={modernColors.primary} />
                <Text style={styles.title}>Partager le suivi</Text>
            </View>

            <Text style={styles.subtitle}>
                Partagez le lien de suivi avec vos proches pour qu'ils puissent suivre votre livraison en temps réel
            </Text>

            {/* Lien */}
            <View style={styles.linkContainer}>
                <Text style={styles.linkText} numberOfLines={1}>
                    {trackingUrl}
                </Text>
                <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopyLink}
                    activeOpacity={0.8}
                >
                    <SafeIcon
                        name={copied ? 'check' : 'copy'}
                        size={18}
                        color={copied ? modernColors.success : modernColors.primary}
                    />
                    <Text style={[styles.copyText, copied && styles.copyTextSuccess]}>
                        {copied ? 'Copié' : 'Copier'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Options de partage */}
            <View style={styles.shareOptions}>
                {shareOptions.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={styles.shareOption}
                        onPress={option.onPress}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.shareIcon, { backgroundColor: option.color + '20' }]}>
                            <SafeIcon name={option.icon} size={24} color={option.color} />
                        </View>
                        <Text style={styles.shareOptionText}>{option.name}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity
                    style={styles.shareOption}
                    onPress={handleShare}
                    activeOpacity={0.8}
                >
                    <View style={[styles.shareIcon, { backgroundColor: modernColors.primary + '20' }]}>
                        <SafeIcon name="more-horizontal" size={24} color={modernColors.primary} />
                    </View>
                    <Text style={styles.shareOptionText}>Plus</Text>
                </TouchableOpacity>
            </View>
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
        lineHeight: 20,
    },
    linkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        gap: 12,
    },
    linkText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.text,
        fontFamily: 'monospace',
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: modernColors.primary + '20',
        borderRadius: 8,
    },
    copyText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    copyTextSuccess: {
        color: modernColors.success,
    },
    shareOptions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    shareOption: {
        alignItems: 'center',
        gap: 8,
    },
    shareIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareOptionText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.text,
    },
});

export default ShareTrackingLink;

