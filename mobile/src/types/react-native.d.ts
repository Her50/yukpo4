/// <reference types="react" />

declare module 'react-native' {
    import * as RN from 'react-native';
    export = RN;
    export as namespace ReactNative;
}

declare module 'react-native-gesture-handler' {
    export const GestureHandlerRootView: any;
    export const TouchableOpacity: any;
    export const ScrollView: any;
    export const FlatList: any;
    export const TextInput: any;
    export const Switch: any;
    export const RefreshControl: any;
    export const DrawerLayout: any;
    export const State: any;
    export const TapGestureHandler: any;
    export const PanGestureHandler: any;
}

declare module 'react-native-paper' {
    export const PaperProvider: any;
    export const TextInput: any;
    export const Button: any;
    export const Card: any;
    export const ActivityIndicator: any;
    export const Badge: any;
    export const Chip: any;
    export const Divider: any;
    export const FAB: any;
    export const IconButton: any;
    export const List: any;
    export const Menu: any;
    export const Modal: any;
    export const Portal: any;
    export const ProgressBar: any;
    export const RadioButton: any;
    export const Searchbar: any;
    export const Snackbar: any;
    export const Surface: any;
    export const Switch: any;
    export const Text: any;
    export const Title: any;
    export const TouchableRipple: any;
}

declare module 'react-native-safe-area-context' {
    export const SafeAreaProvider: any;
    export const SafeAreaView: any;
    export const useSafeAreaInsets: () => any;
    export const useSafeAreaFrame: () => any;
}

declare module '@react-navigation/native' {
    export const NavigationContainer: any;
    export const useNavigation: () => any;
    export const useRoute: () => any;
    export const useFocusEffect: (effect: () => void) => void;
    export const useIsFocused: () => boolean;
    export const useNavigationState: (selector: (state: any) => any) => any;
    export type NavigationProp<T = any> = any;
    export type RouteProp<T = any, K = any> = any;
}

declare module '@react-navigation/stack' {
    export const createStackNavigator: () => any;
    export type StackNavigationProp<T = any> = any;
    export type StackScreenProps<T = any> = any;
}

declare module '@react-navigation/bottom-tabs' {
    export const createBottomTabNavigator: () => any;
    export type BottomTabNavigationProp<T = any> = any;
    export type BottomTabScreenProps<T = any> = any;
}

declare module 'phosphor-react-native' {
    export const House: any;
    export const Briefcase: any;
    export const ChartBar: any;
    export const ClockCounterClockwise: any;
    export const User: any;
    export const Plus: any;
    export const Bell: any;
    export const MagnifyingGlass: any;
    export const MapPin: any;
    export const Camera: any;
    export const Microphone: any;
    export const File: any;
    export const X: any;
    export const Check: any;
    export const Warning: any;
    export const Info: any;
    export const Gear: any;
    export const SignOut: any;
    export const Wallet: any;
    export const Calendar: any;
    export const Eye: any;
    export const ChatCircle: any;
    export const Radio: any;
    export const Shield: any;
    export const Key: any;
    export const Mail: any;
    export const Phone: any;
    export const Globe: any;
    export const Download: any;
    export const Upload: any;
    export const Trash: any;
    export const PencilSimple: any;
    export const Copy: any;
    export const Share: any;
    export const Heart: any;
    export const Star: any;
    export const Lightning: any;
    export const Fire: any;
    export const Drop: any;
    export const Sun: any;
    export const Moon: any;
    export const Cloud: any;
    export const Snowflake: any;
    export const Wind: any;
    export const Umbrella: any;
    export const Tree: any;
    export const Flower: any;
    export const Leaf: any;
    export const Mountains: any;
    export const Waves: any;
    export const Fish: any;
    export const Bird: any;
    export const Dog: any;
    export const Cat: any;
    export const Horse: any;
    export const Butterfly: any;
    export const Bug: any;
    export const Bee: any;
    export const Spider: any;
    export const Snake: any;
    export const Turtle: any;
    export const Elephant: any;
    export const Megaphone: any;
    export const BarChart3: any;
    export const AlertTriangle: any;
}

declare module 'react-native-maps' {
    export default any;
    export const Marker: any;
    export const PROVIDER_GOOGLE: any;
    export const PROVIDER_DEFAULT: any;
    export const Callout: any;
    export const CalloutSubview: any;
    export const Polygon: any;
    export const Polyline: any;
    export const Circle: any;
    export const Overlay: any;
    export const Heatmap: any;
    export const LocalTile: any;
    export const UrlTile: any;
    export const WMSTile: any;
}
