/**
 * Bouton Yukpo IA (style FAB) : ouvre IntelligentChat avec un message d'amorçage contextualisé.
 */

import React, { useCallback } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { hapticPress } from '../../utils/hapticFeedback';
import { openYukpoIntelligentChat } from '../../utils/yukpoIAHelp';

export interface YukpoContextHelpChipProps {
    messageKey: string;
    defaultMessage: string;
    a11yKey: string;
    defaultA11y: string;
}

const YukpoContextHelpChip: React.FC<YukpoContextHelpChipProps> = ({
    messageKey,
    defaultMessage,
    a11yKey,
    defaultA11y,
}) => {
    const { t } = useLanguageSafe();

    const onPress = useCallback(() => {
        hapticPress();
        const seed = t(messageKey, defaultMessage);
        if (!openYukpoIntelligentChat(seed)) {
            Alert.alert(
                t('message.error', 'Erreur'),
                t('bourseUx.yukpoUnavailable', "L'assistant Yukpo IA n'est pas disponible pour le moment.")
            );
        }
    }, [t, messageKey, defaultMessage]);

    return (
        <TouchableOpacity
            style={styles.chip}
            onPress={onPress}
            accessibilityLabel={t(a11yKey, defaultA11y)}
            accessibilityRole="button"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
            <SafeIcon name="sparkles" size={17} color="#fff" type="lucide" />
            <SafeIcon name="bot" size={11} color="#e0e7ff" type="lucide" style={styles.bot} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    chip: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4338ca',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 3,
    },
    bot: {
        position: 'absolute',
        bottom: 5,
        right: 5,
    },
});

export default YukpoContextHelpChip;
