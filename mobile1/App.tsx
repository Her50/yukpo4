import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

// Écrans simplifiés
function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏠 Accueil</Text>
      <Text style={styles.subtitle}>Bienvenue dans Yukpomnang Mobile!</Text>
      <Text style={styles.description}>
        Votre application de services géolocalisés est prête à être utilisée.
      </Text>
    </View>
  );
}

function ServicesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 Services</Text>
      <Text style={styles.subtitle}>Liste des services disponibles</Text>
      <Text style={styles.description}>
        Ici vous trouverez tous les services à proximité.
      </Text>
    </View>
  );
}

function ChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🤖 Chat IA</Text>
      <Text style={styles.subtitle}>Assistant intelligent</Text>
      <Text style={styles.description}>
        Posez vos questions à notre IA.
      </Text>
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>👤 Profil</Text>
      <Text style={styles.subtitle}>Votre compte utilisateur</Text>
      <Text style={styles.description}>
        Gérez votre profil et vos préférences.
      </Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="auto" />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName: keyof typeof Ionicons.glyphMap;

                if (route.name === 'Accueil') {
                  iconName = focused ? 'home' : 'home-outline';
                } else if (route.name === 'Services') {
                  iconName = focused ? 'construct' : 'construct-outline';
                } else if (route.name === 'Chat') {
                  iconName = focused ? 'chatbubble' : 'chatbubble-outline';
                } else if (route.name === 'Profil') {
                  iconName = focused ? 'person' : 'person-outline';
                } else {
                  iconName = 'help-outline';
                }

                return <Ionicons name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: '#007AFF',
              tabBarInactiveTintColor: 'gray',
              headerStyle: {
                backgroundColor: '#007AFF',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            })}
          >
            <Tab.Screen name="Accueil" component={HomeScreen} />
            <Tab.Screen name="Services" component={ServicesScreen} />
            <Tab.Screen name="Chat" component={ChatScreen} />
            <Tab.Screen name="Profil" component={ProfileScreen} />
          </Tab.Navigator>
        </SafeAreaView>
      </NavigationContainer>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
});