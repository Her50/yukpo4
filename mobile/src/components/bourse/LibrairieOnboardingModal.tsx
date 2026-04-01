/**
 * Onboarding partenaire librairie — 3 étapes, une seule fois (SafeStorage).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import SafeStorage from '../../utils/safeStorage';
import { hapticPress } from '../../utils/hapticFeedback';

const STORAGE_KEY = 'librairie_bourse_onboarding_v1_completed';

export async function hasCompletedLibrairieOnboarding(): Promise<boolean> {
    try {
        const v = await SafeStorage.getItem(STORAGE_KEY);
        return v === '1';
    } catch {
        return false;
    }
}

export async function markLibrairieOnboardingComplete(): Promise<void> {
    try {
        await SafeStorage.setItem(STORAGE_KEY, '1');
    } catch {
        /* ignore */
    }
}

interface Props {
    visible: boolean;
    onClose: () => void;
}

const LibrairieOnboardingModal: React.FC<Props> = ({ visible, onClose }) => {
    const { t } = useLanguageSafe();
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (visible) setStep(0);
    }, [visible]);

    const finish = useCallback(async () => {
        await markLibrairieOnboardingComplete();
        setStep(0);
        onClose();
    }, [onClose]);

    const next = useCallback(() => {
        hapticPress();
        if (step >= 2) {
            void finish();
        } else {
            setStep((s) => s + 1);
        }
    }, [step, finish]);

    const skip = useCallback(() => {
        hapticPress();
        void finish();
    }, [finish]);

    const steps = [
        {
            icon: 'store' as const,
            title: t('bourseUx.librairieOnboarding.s1Title', 'Bienvenue, partenaire librairie'),
            body: t(
                'bourseUx.librairieOnboarding.s1Body',
                'Depuis la Bourse du livre, accédez au réseau, aux prix des commandes mixtes et à votre catalogue.'
            ),
        },
        {
            icon: 'network' as const,
            title: t('bourseUx.librairieOnboarding.s2Title', 'Réseau et validation'),
            body: t(
                'bourseUx.librairieOnboarding.s2Body',
                "Renseignez vos prix sur les lignes neufs et validez ou refusez les articles — les familles voient l'état en temps réel."
            ),
        },
        {
            icon: 'book-plus' as const,
            title: t('bourseUx.librairieOnboarding.s3Title', 'Catalogue et équipe'),
            body: t(
                'bourseUx.librairieOnboarding.s3Body',
                'Mettez à jour votre vitrine depuis « Ma librairie » et gérez les accès équipe si besoin.'
            ),
        },
    ];

    const cur = steps[step];

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={skip}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.iconWrap}>
                        <SafeIcon name={cur.icon} size={36} color="#c2410c" type="lucide" />
                    </View>
                    <Text style={styles.title}>{cur.title}</Text>
                    <Text style={styles.body}>{cur.body}</Text>

                    <View style={styles.dots}>
                        {steps.map((_, i) => (
                            <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
                        ))}
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.skipBtn} onPress={skip} activeOpacity={0.85}>
                            <Text style={styles.skipText}>{t('bourseUx.librairieOnboarding.skip', 'Passer')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.88}>
                            <Text style={styles.nextText}>
                                {step >= 2
                                    ? t('bourseUx.librairieOnboarding.done', "C'est parti")
                                    : t('bourseUx.librairieOnboarding.next', 'Suivant')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    sheet: {
        backgroundColor: '#fffbeb',
        borderRadius: 18,
        padding: 22,
        borderWidth: 1,
        borderColor: '#fcd34d',
    },
    iconWrap: {
        alignSelf: 'center',
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#ffedd5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#78350f',
        textAlign: 'center',
        marginBottom: 10,
    },
    body: {
        fontSize: 14,
        lineHeight: 21,
        color: '#92400e',
        textAlign: 'center',
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginTop: 18,
        marginBottom: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fde68a',
    },
    dotOn: {
        backgroundColor: '#ea580c',
        width: 22,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        gap: 12,
    },
    skipBtn: {
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    skipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#a16207',
    },
    nextBtn: {
        flex: 1,
        backgroundColor: '#ea580c',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    nextText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
});

export default LibrairieOnboardingModal;
