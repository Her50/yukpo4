// Composant SafeAreaView natif pour remplacer react-native-safe-area-context
import React from 'react';
import { Dimensions, Platform, StatusBar, StyleSheet, View } from 'react-native';

const { height, width } = Dimensions.get('window');

interface SafeNativeViewProps {
    children: React.ReactNode;
    style?: any;
    edges?: ('top' | 'bottom' | 'left' | 'right')[];
    backgroundColor?: string;
    testID?: string;
}

export const SafeNativeView: React.FC<SafeNativeViewProps> = ({
    children,
    style,
    edges = ['top', 'bottom', 'left', 'right'],
    backgroundColor = '#FFFFFF',
    testID,
}) => {
    const getStatusBarHeight = () => {
        if (Platform.OS === 'android') {
            return StatusBar.currentHeight || 24;
        }
        // iOS - valeurs approximatives
        return 44;
    };

    const getSafeAreaInsets = () => {
        const statusBarHeight = getStatusBarHeight();
        const bottomInset = Platform.OS === 'ios' ? 34 : 0; // iPhone X+ home indicator

        return {
            top: edges.includes('top') ? statusBarHeight : 0,
            bottom: edges.includes('bottom') ? bottomInset : 0,
            left: edges.includes('left') ? 0 : 0,
            right: edges.includes('right') ? 0 : 0,
        };
    };

    const insets = getSafeAreaInsets();

    const containerStyle = [
        styles.container,
        {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            backgroundColor,
        },
        style,
    ];

    return (
        <View style={containerStyle} testID={testID}>
            {children}
        </View>
    );
};

// Composant pour les écrans entiers
export const SafeScreen: React.FC<{
    children: React.ReactNode;
    style?: any;
    backgroundColor?: string;
}> = ({ children, style, backgroundColor = '#FFFFFF' }) => {
    return (
        <SafeNativeView
            style={[styles.screen, style]}
            backgroundColor={backgroundColor}
        >
            {children}
        </SafeNativeView>
    );
};

// Composant pour les conteneurs
export const SafeContainer: React.FC<{
    children: React.ReactNode;
    style?: any;
    padding?: number;
}> = ({ children, style, padding = 16 }) => {
    return (
        <SafeNativeView style={[styles.container, { padding }, style]}>
            {children}
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    screen: {
        flex: 1,
        width: width,
        height: height,
    },
});

export default SafeNativeView;
