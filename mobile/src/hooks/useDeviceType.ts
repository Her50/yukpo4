/**
 * Hook pour détecter le type d'appareil et les breakpoints
 * Niveau géant: Support tablette, paysage, breakpoints adaptatifs
 */

import { useEffect, useState } from 'react';
import { Dimensions, Platform, ScaledSize } from 'react-native';

export interface DeviceType {
    isTablet: boolean;
    isPhone: boolean;
    isSmall: boolean; // < 375px (iPhone SE)
    isMedium: boolean; // 375px - 768px (iPhone standard)
    isLarge: boolean; // 768px - 1024px (iPad mini)
    isXLarge: boolean; // > 1024px (iPad Pro)
    width: number;
    height: number;
    orientation: 'portrait' | 'landscape';
    columns: number; // Nombre de colonnes recommandé pour grid
}

const TABLET_MIN_WIDTH = 768;
const SMALL_MAX_WIDTH = 375;
const MEDIUM_MAX_WIDTH = 768;
const LARGE_MAX_WIDTH = 1024;

export const useDeviceType = (): DeviceType => {
    const [dimensions, setDimensions] = useState(Dimensions.get('window'));

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
            setDimensions(window);
        });

        return () => subscription?.remove();
    }, []);

    const width = dimensions.width;
    const height = dimensions.height;
    const isLandscape = width > height;
    const orientation = isLandscape ? 'landscape' : 'portrait';

    // Détection tablette (iOS/Android)
    const isTablet = Platform.select({
        ios: width >= TABLET_MIN_WIDTH || ((Platform as any).isPad || false),
        android: width >= TABLET_MIN_WIDTH || (width / height) >= 1.6,
        default: width >= TABLET_MIN_WIDTH,
    }) || false;

    const isPhone = !isTablet;

    // Breakpoints
    const isSmall = width < SMALL_MAX_WIDTH;
    const isMedium = width >= SMALL_MAX_WIDTH && width < MEDIUM_MAX_WIDTH;
    const isLarge = width >= MEDIUM_MAX_WIDTH && width < LARGE_MAX_WIDTH;
    const isXLarge = width >= LARGE_MAX_WIDTH;

    // Calcul colonnes pour grid (niveau géant)
    let columns = 1;
    if (isTablet) {
        if (isLandscape) {
            columns = 3; // 3 colonnes en paysage tablette
        } else {
            columns = 2; // 2 colonnes en portrait tablette
        }
    } else if (isLarge) {
        columns = 2; // 2 colonnes sur grands phones
    } else {
        columns = 1; // 1 colonne sur phones standards
    }

    return {
        isTablet,
        isPhone,
        isSmall,
        isMedium,
        isLarge,
        isXLarge,
        width,
        height,
        orientation,
        columns,
    };
};

export default useDeviceType;

