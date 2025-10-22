// Déclarations de types supplémentaires pour React Native
// Pour corriger les erreurs "has no exported member"

declare module 'react-native' {
  // Tous les exports standards de React Native
  export * from 'react-native/types';
  
  // Exports qui peuvent être manquants
  export {
    Animated,
    Image,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Switch,
    ActivityIndicator,
    FlatList,
    SectionList,
    RefreshControl,
    StatusBar,
  } from 'react-native/types';
}
