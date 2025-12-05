import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';

interface StatusIndicatorProps {
    status: string;
    size?: number;
    showPulse?: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
    status,
    size = 12,
    showPulse = true,
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const getStatusColor = () => {
        switch (status) {
            case 'delivered':
                return modernColors.success;
            case 'cancelled':
                return modernColors.error;
            case 'en_route_delivery':
            case 'shopping_completed':
                return modernColors.primary;
            case 'shopping_in_progress':
            case 'en_route_pickup':
                return modernColors.info;
            case 'awaiting_courier':
            case 'pending':
                return modernColors.warning;
            default:
                return modernColors.textSecondary;
        }
    };

    useEffect(() => {
        if (!showPulse) return;

        const pulse = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(pulseAnim, {
                        toValue: 1.5,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1.2,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [showPulse, pulseAnim, scaleAnim]);

    const color = getStatusColor();

    return (
        <View style={styles.container}>
            {showPulse && (
                <Animated.View
                    style={[
                        styles.pulse,
                        {
                            width: size * 2,
                            height: size * 2,
                            borderRadius: size,
                            borderColor: color,
                            transform: [{ scale: pulseAnim }],
                            opacity: pulseAnim.interpolate({
                                inputRange: [1, 1.5],
                                outputRange: [0.6, 0],
                            }),
                        },
                    ]}
                />
            )}
            <Animated.View
                style={[
                    styles.indicator,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: color,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    pulse: {
        position: 'absolute',
        borderWidth: 2,
    },
    indicator: {
        position: 'relative',
    },
});

export default StatusIndicator;

