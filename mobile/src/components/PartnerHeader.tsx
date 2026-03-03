import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface PartnerHeaderProps {
    partnerName?: string;
    logoUrl?: string;
    subtitle?: string;
}

const PartnerHeader: React.FC<PartnerHeaderProps> = ({
    partnerName,
    logoUrl,
    subtitle,
}) => {
    if (!partnerName) return null;

    return (
        <View style={styles.container}>
            <View style={styles.logoContainer}>
                {logoUrl ? (
                    <Image
                        source={{ uri: logoUrl }}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                ) : (
                    <View style={styles.logoPlaceholder}>
                        <SafeIcon name="building" size={20} color={modernColors.primary} />
                    </View>
                )}
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.name} numberOfLines={1}>
                    {partnerName}
                </Text>
                {subtitle && (
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    logoContainer: {
        marginRight: 12,
    },
    logo: {
        width: 40,
        height: 40,
        borderRadius: 8,
    },
    logoPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    textContainer: {
        flex: 1,
    },
    name: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    subtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
});

export default PartnerHeader;
