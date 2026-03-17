import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { SafeNativeView } from './SafeNativeView';
import { useLanguageSafe } from '../contexts/LanguageContext';

type NavigatorToolbarTone = 'light' | 'dark';

interface NavigatorToolbarProps {
    title?: string;
    subtitle?: string;
    onClose?: () => void;
    rightSlot?: React.ReactNode;
    tone?: NavigatorToolbarTone;
    showHandle?: boolean;
    density?: 'default' | 'compact';
    backIcon?: 'close' | 'back' | false; // ✅ NOUVEAU 2026-02-06: false pour masquer le bouton retour
    backgroundColor?: string;
}

export const NavigatorToolbar: React.FC<NavigatorToolbarProps> = ({
    title,
    subtitle,
    onClose,
    rightSlot,
    tone = 'light',
    showHandle = false,
    density = showHandle ? 'default' : 'compact',
    backIcon = 'close',
    backgroundColor = 'transparent',
}) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();

    const isDark = tone === 'dark';
    const textColor = isDark ? '#FFFFFF' : modernColors.text;
    const subTextColor = isDark ? 'rgba(255,255,255,0.7)' : modernColors.textSecondary;

    const paddingVertical = density === 'compact' ? modernStyles.spacing.xs : modernStyles.spacing.sm;
    const actionSize = density === 'compact' ? 32 : 36;
    const iconName = backIcon === 'back' ? 'arrow-left' : 'x';
    const showBackButton = backIcon !== false; // ✅ NOUVEAU 2026-02-06: Masquer le bouton si backIcon === false

    const handleClose = () => {
        if (onClose) {
            onClose();
            return;
        }

        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    };

    return (
        <SafeNativeView
            edges={['top']}
            backgroundColor={backgroundColor}
            style={[
                styles.safeContainer,
                { paddingBottom: paddingVertical },
                backgroundColor !== 'transparent' && { backgroundColor }
            ]}
        >
            <View
                style={[
                    styles.container,
                    { gap: density === 'compact' ? modernStyles.spacing.xs : modernStyles.spacing.sm }
                ]}
            >
                {showHandle && (
                    <View
                        style={[
                            styles.handle,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.12)' },
                        ]}
                    />
                )}

                <View style={[styles.toolbarRow, { marginTop: showHandle ? paddingVertical : 0 }]}>
                    {/* ✅ NOUVEAU 2026-02-06: Afficher le bouton retour seulement si showBackButton est true */}
                    {showBackButton && (
                        <TouchableOpacity
                            onPress={handleClose}
                            style={[
                                styles.actionButton,
                                {
                                    width: actionSize,
                                    height: actionSize,
                                    borderRadius: actionSize / 2,
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.06)',
                                },
                            ]}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name={iconName} size={18} color={textColor} />
                        </TouchableOpacity>
                    )}

                    <View style={[
                        styles.titleContainer,
                        // ✅ NOUVEAU 2026-02-06: Décaler le titre plus à gauche si pas de bouton retour
                        !showBackButton && styles.titleContainerNoBack
                    ]}>
                        {title ? (
                            <Text
                                style={[
                                    styles.title,
                                    density === 'compact' && styles.titleCompact,
                                    { color: textColor }
                                ]}
                                numberOfLines={1}
                            >
                                {title}
                            </Text>
                        ) : null}
                        {subtitle ? (
                            <Text
                                style={[
                                    styles.subtitle,
                                    density === 'compact' && styles.subtitleCompact,
                                    { color: subTextColor }
                                ]}
                                numberOfLines={1}
                            >
                                {subtitle}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.rightSlot}>{rightSlot}</View>
                </View>
            </View>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    safeContainer: {
        paddingBottom: modernStyles.spacing.sm,
        flex: 0,
    },
    container: {
        paddingHorizontal: modernStyles.spacing.md,
        gap: modernStyles.spacing.sm,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 999,
    },
    toolbarRow: {
        flexDirection: 'row',
        alignItems: 'flex-start', // ✅ CORRIGÉ: Aligner en haut pour remonter le titre
        justifyContent: 'space-between',
        paddingTop: 4, // ✅ Ajouter un petit padding pour compenser
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2, // ✅ CORRIGÉ: Ajouter un petit marginTop pour aligner avec le titre
    },
    titleContainer: {
        flex: 1,
        marginHorizontal: modernStyles.spacing.sm,
        justifyContent: 'flex-start', // ✅ CORRIGÉ: Aligner le contenu en haut
        paddingTop: 2, // ✅ CORRIGÉ: Ajouter un petit paddingTop pour remonter le titre
    },
    // ✅ NOUVEAU 2026-02-06: Style pour décaler le titre plus à gauche quand pas de bouton retour
    titleContainerNoBack: {
        marginLeft: 0, // Pas de marge à gauche, le titre commence au bord
        paddingLeft: modernStyles.spacing.md, // Padding depuis le bord gauche de l'écran
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
    },
    titleCompact: {
        fontSize: 15,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    subtitleCompact: {
        fontSize: 11,
    },
    rightSlot: {
        minWidth: 36,
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2, // ✅ CORRIGÉ: Ajouter un petit marginTop pour aligner avec le titre
    },
});

export default NavigatorToolbar;

