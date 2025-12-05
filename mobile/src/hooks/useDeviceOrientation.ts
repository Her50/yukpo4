/**
 * useDeviceOrientation - Hook pour gérer l'orientation de l'appareil
 * Support landscape et portrait avec adaptation automatique
 */

import { useEffect, useState } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

export type Orientation = 'portrait' | 'landscape';

interface UseDeviceOrientationReturn {
    orientation: Orientation;
    isLandscape: boolean;
    isPortrait: boolean;
    width: number;
    height: number;
    screenData: ScaledSize;
}

export const useDeviceOrientation = (): UseDeviceOrientationReturn => {
    const [dimensions, setDimensions] = useState(Dimensions.get('window'));

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setDimensions(window);
        });

        return () => {
            subscription?.remove();
        };
    }, []);

    const width = dimensions.width;
    const height = dimensions.height;
    const isLandscape = width > height;
    const isPortrait = !isLandscape;
    const orientation: Orientation = isLandscape ? 'landscape' : 'portrait';

    return {
        orientation,
        isLandscape,
        isPortrait,
        width,
        height,
        screenData: dimensions,
    };
};

