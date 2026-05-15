import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Home, Search, ShoppingCart, FileText } from 'lucide-react-native';
import 'react-native-gesture-handler';

import PharmacieHomeScreen from '@shared/screens/specialized/PharmacieHomeScreen';
import PharmacieSearchScreen from '@shared/screens/specialized/PharmacieSearchScreen';
import PharmacieListScreen from '@shared/screens/specialized/PharmacieListScreen';
import PharmacieDetailsScreen from '@shared/screens/specialized/PharmacieDetailsScreen';
import PharmacieFormScreen from '@shared/screens/specialized/PharmacieFormScreen';
import MyPharmacyOrdersScreen from '@shared/screens/specialized/MyPharmacyOrdersScreen';
import OrdonnanceUploadScreen from '@shared/screens/specialized/OrdonnanceUploadScreen';
import OrdonnanceDetailsScreen from '@shared/screens/specialized/OrdonnanceDetailsScreen';
import MedicamentScanScreen from '@shared/screens/specialized/MedicamentScanScreen';
import RappelsMedicamentsScreen from '@shared/screens/specialized/RappelsMedicamentsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const THEME = '#059669';

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
      }}
    >
      <Tab.Screen name="Home" component={PharmacieHomeScreen} options={{ title: 'Accueil', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tab.Screen name="Search" component={PharmacieSearchScreen} options={{ title: 'Rechercher', tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
      <Tab.Screen name="Orders" component={MyPharmacyOrdersScreen} options={{ title: 'Commandes', tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} /> }} />
      <Tab.Screen name="Prescriptions" component={RappelsMedicamentsScreen} options={{ title: 'Rappels', tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="PharmacieList" component={PharmacieListScreen} />
        <Stack.Screen name="PharmacieDetails" component={PharmacieDetailsScreen} />
        <Stack.Screen name="PharmacieForm" component={PharmacieFormScreen} />
        <Stack.Screen name="OrdonnanceUpload" component={OrdonnanceUploadScreen} />
        <Stack.Screen name="OrdonnanceDetails" component={OrdonnanceDetailsScreen} />
        <Stack.Screen name="MedicamentScan" component={MedicamentScanScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
