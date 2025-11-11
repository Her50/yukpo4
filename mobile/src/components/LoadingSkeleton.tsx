import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

interface LoadingSkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
    inline?: boolean;
}

const DEFAULT_COLOR = 'rgba(148, 163, 184, 0.35)'; // slate-400 @ 35%
const HIGHLIGHT_COLOR = 'rgba(148, 163, 184, 0.65)';

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
    width = '100%',
    height = 18,
    borderRadius = 12,
    style,
}) => {
    const animation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(animation, {
                    toValue: 1,
                    duration: 900,
                    useNativeDriver: false,
                }),
                Animated.timing(animation, {
                    toValue: 0,
                    duration: 900,
                    useNativeDriver: false,
                }),
            ]),
        );
        loop.start();

        return () => {
            loop.stop();
        };
    }, [animation]);

    const backgroundColor = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [DEFAULT_COLOR, HIGHLIGHT_COLOR],
    });

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor,
                },
                style,
            ]}
        />
    );
};

export default LoadingSkeleton;

