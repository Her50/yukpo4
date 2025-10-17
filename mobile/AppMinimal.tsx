import { Text, View } from 'react-native';

export default function AppMinimal() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#6366F1' }}>
            <Text style={{ color: 'white', fontSize: 20 }}>Yukpomnang OK!</Text>
        </View>
    );
}