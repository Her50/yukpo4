// Déclarations de types pour React Native
declare module 'react-native' {
    import { ComponentType } from 'react';

    export const View: ComponentType<any>;
    export const Text: ComponentType<any>;
    export const TouchableOpacity: ComponentType<any>;
    export const ScrollView: ComponentType<any>;
    export const ActivityIndicator: ComponentType<any>;
    export const Alert: any;
    export const RefreshControl: ComponentType<any>;
    export const StyleSheet: any;
    export const Dimensions: any;
}

declare module 'expo-linear-gradient' {
    export const LinearGradient: any;
}

declare module '@expo/vector-icons/Ionicons' {
    export const Ionicons: any;
}

declare module 'lucide-react-native' {
    export const LucideIcons: any;
}



