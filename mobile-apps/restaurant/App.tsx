import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Home, Search, ShoppingBag, User } from 'lucide-react-native';
import 'react-native-gesture-handler';

import RestaurantClientScreen from '@shared/screens/specialized/RestaurantClientScreen';
import RestaurantDashboardScreen from '@shared/screens/specialized/RestaurantDashboardScreen';
import MesReservationsScreen from '@shared/screens/specialized/MesReservationsScreen';
import RecipeSearchScreen from '@shared/screens/specialized/RecipeSearchScreen';
import RecipeDetailsScreen from '@shared/screens/specialized/RecipeDetailsScreen';
import MenuWeekCalendarScreen from '@shared/screens/specialized/MenuWeekCalendarScreen';
import MenuPlanningHubScreen from '@shared/screens/specialized/MenuPlanningHubScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const THEME = '#dc2626';

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
      <Tab.Screen name="Home" component={RestaurantClientScreen} options={{ title: 'Accueil', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tab.Screen name="Search" component={RecipeSearchScreen} options={{ title: 'Explorer', tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
      <Tab.Screen name="Orders" component={MesReservationsScreen} options={{ title: 'Commandes', tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} /> }} />
      <Tab.Screen name="Profile" component={RestaurantDashboardScreen} options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="RecipeDetails" component={RecipeDetailsScreen} />
        <Stack.Screen name="MenuWeek" component={MenuWeekCalendarScreen} />
        <Stack.Screen name="MenuPlanning" component={MenuPlanningHubScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
