import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';

interface YukpoBrandProps {
    style?: TextStyle;
}

export const YukpoBrand: React.FC<YukpoBrandProps> = ({ style }) => (
    <Text style={[styles.brand, style]}>
        <Text style={styles.yuk}>Yuk</Text>
        <Text style={styles.po}>po</Text>
    </Text>
);

const styles = StyleSheet.create({
    brand: {
        fontWeight: 'bold',
        fontSize: 24,
    },
    yuk: {
        color: '#F59E0B', // yellow-500
    },
    po: {
        color: '#DC2626', // red-600
    },
});

