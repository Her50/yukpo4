import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Bell, Briefcase, ChartBar, House, MagnifyingGlass } from 'phosphor-react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';

// Import des écrans de test
import HomeScreen from '../screens/HomeScreen'; // HomeScreen amélioré
import TestCreateServiceScreen from '../screens/TestCreateServiceScreen';
import TestDashboardScreen from '../screens/TestDashboardScreen';
import TestNotificationScreen from '../screens/TestNotificationScreen';
import TestSearchScreen from '../screens/TestSearchScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator de test
const TestTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }: any) => ({
                tabBarIcon: ({ focused, color, size }: any) => {
                    const iconProps = {
                        size: size,
                        color: color,
                        weight: (focused ? 'fill' : 'regular') as any,
                        style: { marginBottom: focused ? 2 : 0 }
                    };

                    switch (route.name) {
                        case 'Home':
                            return <House {...iconProps} />;
                        case 'Dashboard':
                            return <ChartBar {...iconProps} />;
                        case 'CreateService':
                            return <Briefcase {...iconProps} />;
                        case 'Search':
                            return <MagnifyingGlass {...iconProps} />;
                        case 'Notifications':
                            return <Bell {...iconProps} />;
                        default:
                            return <House {...iconProps} />;
                    }
                },
                tabBarActiveTintColor: modernColors.primary,
                tabBarInactiveTintColor: modernColors.textTertiary,
                tabBarStyle: {
                    backgroundColor: modernColors.surface,
                    borderTopWidth: 0,
                    paddingBottom: 12,
                    paddingTop: 12,
                    height: 85,
                    ...modernStyles.shadowMedium,
                    borderRadius: modernStyles.borderRadius.large,
                    marginHorizontal: modernStyles.spacing.md,
                    marginBottom: modernStyles.spacing.md,
                    position: 'absolute',
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    marginBottom: 2,
                    marginTop: 2,
                },
                headerShown: false,
            })}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    title: 'Accueil',
                    tabBarLabel: 'Accueil'
                }}
            />
            <Tab.Screen
                name="Dashboard"
                component={TestDashboardScreen}
                options={{
                    title: 'Dashboard Test',
                    tabBarLabel: 'Dashboard'
                }}
            />
            <Tab.Screen
                name="CreateService"
                component={TestCreateServiceScreen}
                options={{
                    title: 'Créer Service',
                    tabBarLabel: 'Créer'
                }}
            />
            <Tab.Screen
                name="Search"
                component={TestSearchScreen}
                options={{
                    title: 'Recherche',
                    tabBarLabel: 'Recherche'
                }}
            />
            <Tab.Screen
                name="Notifications"
                component={TestNotificationScreen}
                options={{
                    title: 'Notifications',
                    tabBarLabel: 'Notifications'
                }}
            />
        </Tab.Navigator>
    );
};

// Stack Navigator principal
const TestNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="TestTabs" component={TestTabs} />
        </Stack.Navigator>
    );
};

export default TestNavigator;











