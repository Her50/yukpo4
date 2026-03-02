import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { BRAND_PO_COLOR, BRAND_TEXT_PRIMARY, BRAND_YUK_COLOR } from '../theme/brandColors';

interface YukpoBrandProps {
    style?: TextStyle;
    variant?: 'default' | 'onDark' | 'solid';
}

export const YukpoBrand: React.FC<YukpoBrandProps> = ({ style, variant = 'default' }) => {
    const yukColor = variant === 'onDark' ? '#FFFFFF' : BRAND_YUK_COLOR;
    const poColor = variant === 'onDark' ? 'rgba(255,255,255,0.85)' : BRAND_PO_COLOR;
    const solidColor = variant === 'solid' ? BRAND_TEXT_PRIMARY : undefined;

    return (
        <Text style={[styles.brand, style]}>
            <Text style={[styles.yuk, { color: solidColor || yukColor }]}>Yuk</Text>
            <Text style={[styles.po, { color: solidColor || poColor }]}>po</Text>
        </Text>
    );
};

const styles = StyleSheet.create({
    brand: {
        fontWeight: '900',
        fontSize: 24,
        letterSpacing: -0.3,
    },
    yuk: {
        color: BRAND_YUK_COLOR,
    },
    po: {
        color: BRAND_PO_COLOR,
    },
});






