// Déclarations de types pour React Navigation
declare module '@react-navigation/native' {
    export function useNavigation(): any;
    export function useRoute(): any;
    export function useFocusEffect(callback: () => void | (() => void)): void;
    export function useIsFocused(): boolean;
}

declare module '@react-navigation/stack' {
    export function createStackNavigator(): any;
}

declare module '@react-navigation/bottom-tabs' {
    export function createBottomTabNavigator(): any;
}