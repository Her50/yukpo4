/**
 * SearchActionsBottomSheet - Bottom sheet pour les actions de recherche avancée
 * Remplace le modal traditionnel par un bottom sheet moderne (style iOS/Android)
 */

import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface SearchActionsBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onTakePhoto: () => void;
    onChooseImages: () => void;
    onPickDocument: () => void;
    onSelectGPS: () => void;
}

const SearchActionsBottomSheet: React.FC<SearchActionsBottomSheetProps> = ({
    isOpen,
    onClose,
    onTakePhoto,
    onChooseImages,
    onPickDocument,
    onSelectGPS,
}) => {
    const snapPoints = useMemo(() => ['35%'], []);

    const bottomSheetRef = React.useRef<BottomSheet>(null);

    // Ouvrir/fermer le bottom sheet
    React.useEffect(() => {
        if (isOpen) {
            bottomSheetRef.current?.expand();
        } else {
            bottomSheetRef.current?.close();
        }
    }, [isOpen]);

    // Backdrop personnalisé
    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
                pressBehavior="close"
            />
        ),
        []
    );

    const handleAction = useCallback((action: () => void) => {
        hapticPress();
        bottomSheetRef.current?.close();
        // Petit délai pour que l'animation de fermeture soit visible
        setTimeout(() => {
            action();
        }, 200);
    }, []);

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            onClose={onClose}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            animateOnMount
        >
            <BottomSheetView style={styles.contentContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>{t('searchActionsBottomSheet.rechercheAvancee')}</Text>
                    <Text style={styles.subtitle}>Choisissez une option pour affiner votre recherche</Text>
                </View>

                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => handleAction(onSelectGPS)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#ECFEFF' }]}>
                            <SafeIcon name="map-pin" size={24} color={modernColors.primary} />
                        </View>
                        <Text style={styles.actionLabel}>{t('searchActionsBottomSheet.localisation')}</Text>
                        <Text style={styles.actionDescription}>GPS ou zone</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => handleAction(onTakePhoto)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#FEF3C7' }]}>
                            <SafeIcon name="camera" size={24} color="#F59E0B" />
                        </View>
                        <Text style={styles.actionLabel}>Photo</Text>
                        <Text style={styles.actionDescription}>Prendre une photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => handleAction(onChooseImages)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#E0E7FF' }]}>
                            <SafeIcon name="image" size={24} color={modernColors.primary} />
                        </View>
                        <Text style={styles.actionLabel}>Galerie</Text>
                        <Text style={styles.actionDescription}>{t('searchActionsBottomSheet.choisirDesImages')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => handleAction(onPickDocument)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#F3E8FF' }]}>
                            <SafeIcon name="file-text" size={24} color="#9333EA" />
                        </View>
                        <Text style={styles.actionLabel}>Document</Text>
                        <Text style={styles.actionDescription}>Fichier PDF, etc.</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheetView>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    bottomSheetBackground: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    handleIndicator: {
        backgroundColor: '#D1D5DB',
        width: 40,
        height: 4,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 32,
    },
    header: {
        marginBottom: 24,
        gap: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'space-between',
    },
    actionCard: {
        width: '47%',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 8,
    },
    actionIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    actionLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
    },
    actionDescription: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
});

export default SearchActionsBottomSheet;

