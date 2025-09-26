import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

const LoadingScreen = () => {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.text}>Chargement...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    text: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
    },
});

export default LoadingScreen;

