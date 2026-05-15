import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Home, Search, BookOpen, User } from 'lucide-react-native';
import 'react-native-gesture-handler';

import LivreScolaireHomeScreen from '@shared/screens/specialized/LivreScolaireHomeScreen';
import LivreScolaireSearchScreen from '@shared/screens/specialized/LivreScolaireSearchScreen';
import LivreScolaireListScreen from '@shared/screens/specialized/LivreScolaireListScreen';
import LivreScolaireDetailsScreen from '@shared/screens/specialized/LivreScolaireDetailsScreen';
import LivreScolaireFormScreen from '@shared/screens/specialized/LivreScolaireFormScreen';
import MesLivresScreen from '@shared/screens/specialized/MesLivresScreen';
import MesBesoinsLivresScreen from '@shared/screens/specialized/MesBesoinsLivresScreen';
import ProgrammeBesoinsSelectorScreen from '@shared/screens/specialized/ProgrammeBesoinsSelectorScreen';
import EtablissementScolaireScreen from '@shared/screens/specialized/EtablissementScolaireScreen';
import BookUploadV2Screen from '@shared/screens/specialized/BookUploadV2Screen';
import BookRecapV2Screen from '@shared/screens/specialized/BookRecapV2Screen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const THEME = '#d97706';

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
      <Tab.Screen name="Home" component={LivreScolaireHomeScreen} options={{ title: 'Accueil', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tab.Screen name="Search" component={LivreScolaireSearchScreen} options={{ title: 'Rechercher', tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
      <Tab.Screen name="MyBooks" component={MesLivresScreen} options={{ title: 'Mes livres', tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
      <Tab.Screen name="Profile" component={EtablissementScolaireScreen} options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="LivreScolaireList" component={LivreScolaireListScreen} />
        <Stack.Screen name="LivreScolaireDetails" component={LivreScolaireDetailsScreen} />
        <Stack.Screen name="LivreScolaireForm" component={LivreScolaireFormScreen} />
        <Stack.Screen name="MesBesoinsLivres" component={MesBesoinsLivresScreen} />
        <Stack.Screen name="ProgrammeBesoins" component={ProgrammeBesoinsSelectorScreen} />
        <Stack.Screen name="BookUpload" component={BookUploadV2Screen} />
        <Stack.Screen name="BookRecap" component={BookRecapV2Screen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
