import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../SafeIcon';
import { NativeButton } from '../SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { deliveryApi } from '../../services/api';
import { notificationSoundService } from '../../services/notificationSoundService';
import { modernColors } from '../../theme/modernTheme';

const AUTO_DISMISS_MS = 30_000;

interface IncomingOrderData {
    deliveryId: string;
    pickupAddress: string;
    dropoffAddress: string;
    estimatedDistance?: string;
    estimatedEarnings?: number;
    packageType?: string;
}

interface IncomingOrderModalProps {
    visible: boolean;
    order: IncomingOrderData | null;
    onAccepted: (deliveryId: string) => void;
    onDismissed: () => void;
}

function formatXAF(amount: number): string {
    return `${Math.round(amount).toLocaleString('fr-FR')} XAF`;
}

const IncomingOrderModal: React.FC<IncomingOrderModalProps> = ({
    visible,
    order,
    onAccepted,
    onDismissed,
}) => {
    const { t } = useLanguageSafe();
    const [accepting, setAccepting] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_MS / 1000);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const clearTimers = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (visible && order) {
            setSecondsLeft(AUTO_DISMISS_MS / 1000);

            notificationSoundService.playSound('delivery_request').catch(() => {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                ]),
            ).start();

            timerRef.current = setInterval(() => {
                setSecondsLeft((prev) => {
                    if (prev <= 1) {
                        clearTimers();
                        onDismissed();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => {
                clearTimers();
                pulseAnim.stopAnimation();
            };
        }
        return clearTimers;
    }, [visible, order]);

    const handleAccept = async () => {
        if (!order || accepting) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        setAccepting(true);
        try {
            const res = await deliveryApi.acceptDelivery(order.deliveryId);
            if (res.success || (res as any).data) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                onAccepted(order.deliveryId);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            }
        } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        } finally {
            setAccepting(false);
        }
    };

    const handleRefuse = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        clearTimers();
        onDismissed();
    };

    if (!order) return null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleRefuse}>
            <View style={styles.overlay}>
                <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
                    <View style={styles.timerRow}>
                        <SafeIcon name="clock" size={14} color={modernColors.warning} type="lucide" />
                        <Text style={styles.timerText}>
                            {secondsLeft}s
                        </Text>
                    </View>

                    <View style={styles.iconContainer}>
                        <SafeIcon name="package" size={36} color={modernColors.primary} type="lucide" />
                    </View>

                    <Text style={styles.title}>
                        {t('courier.newOrder') || 'Nouvelle course disponible'}
                    </Text>

                    <View style={styles.infoSection}>
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={16} color={modernColors.success} type="lucide" />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>{t('delivery.pickup') || 'Ramassage'}</Text>
                                <Text style={styles.infoValue} numberOfLines={2}>{order.pickupAddress}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={16} color={modernColors.error} type="lucide" />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>{t('delivery.dropoff') || 'Livraison'}</Text>
                                <Text style={styles.infoValue} numberOfLines={2}>{order.dropoffAddress}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        {order.estimatedDistance && (
                            <View style={styles.statItem}>
                                <SafeIcon name="navigation" size={16} color={modernColors.info} type="lucide" />
                                <Text style={styles.statValue}>{order.estimatedDistance}</Text>
                            </View>
                        )}

                        {order.estimatedEarnings != null && (
                            <View style={styles.statItem}>
                                <SafeIcon name="banknote" size={16} color={modernColors.success} type="lucide" />
                                <Text style={[styles.statValue, { color: modernColors.success }]}>
                                    {formatXAF(order.estimatedEarnings)}
                                </Text>
                            </View>
                        )}

                        {order.packageType && (
                            <View style={styles.statItem}>
                                <SafeIcon name="box" size={16} color={modernColors.textSecondary} type="lucide" />
                                <Text style={styles.statValue}>{order.packageType}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.refuseBtn} onPress={handleRefuse}>
                            <SafeIcon name="x" size={20} color={modernColors.error} type="lucide" />
                            <Text style={styles.refuseBtnText}>{t('actions.refuse') || 'Refuser'}</Text>
                        </TouchableOpacity>

                        <NativeButton
                            title={accepting
                                ? (t('message.loading') || 'Chargement...')
                                : (t('actions.accept') || 'Accepter')}
                            onPress={handleAccept}
                            disabled={accepting}
                            style={styles.acceptBtn}
                        />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: modernColors.overlay,
        justifyContent: 'flex-end',
        padding: 16,
        paddingBottom: 32,
    },
    card: {
        backgroundColor: modernColors.surface,
        borderRadius: 24,
        padding: 24,
        gap: 16,
    },
    timerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    timerText: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.warning,
    },
    iconContainer: {
        alignSelf: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: modernColors.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        textAlign: 'center',
    },
    infoSection: {
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 14,
        padding: 14,
        gap: 10,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textTertiary,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: modernColors.border,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    refuseBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: modernColors.error,
        backgroundColor: modernColors.error + '08',
    },
    refuseBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.error,
    },
    acceptBtn: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: modernColors.success,
    },
});

export default IncomingOrderModal;
