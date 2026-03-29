/**
 * Bandeau erreur réseau + réessayer — usage transversal bourse / livraison.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';

interface Props {
    message: string;
    onRetry: () => void;
    retryLabel: string;
}

const NetworkRetryBanner: React.FC<Props> = ({ message, onRetry, retryLabel }) => {
    return (
        <View style={styles.banner}>
            <SafeIcon name="wifi-off" size={18} color="#b45309" type="lucide" />
            <Text style={styles.msg}>{message}</Text>
            <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
                <Text style={styles.btnText}>{retryLabel}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fcd34d',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    msg: {
        flex: 1,
        fontSize: 13,
        color: '#92400e',
        lineHeight: 18,
    },
    btn: {
        backgroundColor: modernColors.primary,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    btnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
});

export default NetworkRetryBanner;
