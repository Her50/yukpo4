import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface MessageStatusIndicatorProps {
    status: 'sending' | 'sent' | 'delivered' | 'read';
    timestamp?: Date | string;
    isFromClient?: boolean;
}

const MessageStatusIndicator: React.FC<MessageStatusIndicatorProps> = ({
    status,
    timestamp,
    isFromClient = false,
}) => {
    const getStatusIcon = () => {
        switch (status) {
            case 'sending':
                return (
                    <View style={styles.statusContainer}>
                        <View style={[styles.statusDot, styles.statusDotSending]} />
                    </View>
                );
            case 'sent':
                return (
                    <SafeIcon
                        name="check"
                        size={14}
                        color={isFromClient ? '#FFFFFF' : modernColors.textSecondary}
                    />
                );
            case 'delivered':
                return (
                    <SafeIcon
                        name="check"
                        size={14}
                        color={isFromClient ? '#FFFFFF' : modernColors.textSecondary}
                    />
                );
            case 'read':
                return (
                    <SafeIcon
                        name="check"
                        size={14}
                        color={isFromClient ? modernColors.info : modernColors.primary}
                    />
                );
            default:
                return null;
        }
    };

    const formatTime = (date: Date | string) => {
        try {
            const dateObj = typeof date === 'string' ? new Date(date) : date;
            if (isNaN(dateObj.getTime())) {
                return '--:--';
            }
            return dateObj.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (error) {
            return '--:--';
        }
    };

    return (
        <View style={styles.container}>
            {timestamp && (
                <Text
                    style={[
                        styles.timestamp,
                        isFromClient && styles.timestampClient,
                    ]}
                >
                    {formatTime(timestamp)}
                </Text>
            )}
            <View style={styles.statusIconContainer}>
                {status === 'delivered' || status === 'read' ? (
                    <View style={styles.doubleCheckContainer}>
                        {getStatusIcon()}
                        <View style={styles.secondCheck}>
                            {getStatusIcon()}
                        </View>
                    </View>
                ) : (
                    getStatusIcon()
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timestamp: {
        fontSize: 11,
        color: modernColors.textSecondary,
        opacity: 0.7,
    },
    timestampClient: {
        color: '#FFFFFF',
    },
    statusIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusContainer: {
        width: 14,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusDotSending: {
        backgroundColor: modernColors.textSecondary,
        opacity: 0.5,
    },
    doubleCheckContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: -2,
    },
    secondCheck: {
        marginLeft: -6,
    },
});

export default MessageStatusIndicator;

