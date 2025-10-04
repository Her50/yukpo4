declare module 'expo-status-bar' {
    export const StatusBar: any;
    export type StatusBarStyle = 'auto' | 'inverted' | 'light' | 'dark';
}

declare module 'expo-location' {
    export * from 'expo-location';
}

declare module 'expo-image-picker' {
    export * from 'expo-image-picker';
}

declare module 'expo-document-picker' {
    export * from 'expo-document-picker';
}

declare module 'expo-av' {
    export * from 'expo-av';
}

declare module 'expo-font' {
    export * from 'expo-font';
}

declare module 'expo-clipboard' {
    export * from 'expo-clipboard';
}

declare module 'expo-splash-screen' {
    export * from 'expo-splash-screen';
}

declare module '@react-native-async-storage/async-storage' {
    const AsyncStorage: any;
    export default AsyncStorage;
}
