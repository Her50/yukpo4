// Écran d'accueil ultra-moderne avec animations et glassmorphism
import LinearGradient from 'react-native-linear-gradient';
import {
  Bell,
  Clock,
  Heart,
  House,
  MagnifyingGlass,
  MapPin,
  Plus,
  Star,
  TrendUp,
  Users
} from 'phosphor-react-native';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ModernCard from '../components/ModernCard';
import { modernColors, modernStyles } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

const ModernHomeScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Animation d'entrée fluide
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const QuickAction = ({ icon: Icon, title, onPress, gradient }: any) => (
    <TouchableOpacity onPress={onPress} style={styles.quickActionContainer}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.quickAction}
      >
        <Icon size={24} color="white" weight="bold" />
      </LinearGradient>
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  const StatCard = ({ icon: Icon, title, value, color, trend }: any) => (
    <ModernCard variant="glass" style={styles.statCard}>
      <View style={styles.statHeader}>
        <Icon size={20} color={color} weight="bold" />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {trend && (
        <View style={styles.trendContainer}>
          <TrendUp size={12} color={modernColors.success} weight="bold" />
          <Text style={styles.trendText}>{trend}</Text>
        </View>
      )}
    </ModernCard>
  );

  return (
    <LinearGradient
      colors={modernColors.primaryGradient}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Header moderne */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>Bonjour ! 👋</Text>
              <Text style={styles.userName}>Prêt à découvrir ?</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconButton}>
                <Bell size={24} color="white" weight="bold" />
                <View style={styles.notificationBadge} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Barre de recherche moderne */}
          <ModernCard variant="glass" style={styles.searchCard}>
            <View style={styles.searchContainer}>
              <MagnifyingGlass size={20} color="white" weight="bold" />
              <Text style={styles.searchPlaceholder}>Rechercher un service...</Text>
            </View>
          </ModernCard>

          {/* Actions rapides */}
          <View style={styles.quickActionsContainer}>
            <Text style={styles.sectionTitle}>Actions rapides</Text>
            <View style={styles.quickActions}>
              <QuickAction
                icon={Plus}
                title="Créer"
                gradient={modernColors.secondaryGradient}
                onPress={() => { }}
              />
              <QuickAction
                icon={MagnifyingGlass}
                title="Rechercher"
                gradient={modernColors.successGradient}
                onPress={() => { }}
              />
              <QuickAction
                icon={Heart}
                title="Favoris"
                gradient={modernColors.warningGradient}
                onPress={() => { }}
              />
              <QuickAction
                icon={MapPin}
                title="Proche"
                gradient={['#667eea', '#764ba2']}
                onPress={() => { }}
              />
            </View>
          </View>

          {/* Statistiques */}
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Vos statistiques</Text>
            <View style={styles.statsGrid}>
              <StatCard
                icon={Users}
                title="Services"
                value="12"
                color={modernColors.primary}
                trend="+2 cette semaine"
              />
              <StatCard
                icon={Star}
                title="Évaluations"
                value="4.8"
                color={modernColors.warning}
                trend="+0.2"
              />
              <StatCard
                icon={Clock}
                title="Temps moyen"
                value="2h"
                color={modernColors.success}
                trend="-15min"
              />
            </View>
          </View>

          {/* Services récents */}
          <View style={styles.recentContainer}>
            <Text style={styles.sectionTitle}>Services récents</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[1, 2, 3].map((item) => (
                <ModernCard key={item} variant="glass" style={styles.serviceCard}>
                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceIcon}>
                      <House size={20} color={modernColors.primary} weight="bold" />
                    </View>
                    <Text style={styles.serviceTitle}>Service {item}</Text>
                  </View>
                  <Text style={styles.serviceDescription}>
                    Description du service avec détails...
                  </Text>
                  <View style={styles.serviceFooter}>
                    <Text style={styles.servicePrice}>25€</Text>
                    <Star size={16} color={modernColors.warning} weight="fill" />
                    <Text style={styles.serviceRating}>4.8</Text>
                  </View>
                </ModernCard>
              ))}
            </ScrollView>
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: modernStyles.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: modernStyles.spacing.xl,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    position: 'relative',
    padding: modernStyles.spacing.sm,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: modernColors.error,
  },
  searchCard: {
    marginBottom: modernStyles.spacing.xl,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: modernStyles.spacing.md,
  },
  searchPlaceholder: {
    marginLeft: modernStyles.spacing.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  quickActionsContainer: {
    marginBottom: modernStyles.spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: modernStyles.spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionContainer: {
    alignItems: 'center',
    flex: 1,
  },
  quickAction: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: modernStyles.spacing.sm,
    ...modernStyles.shadowMedium,
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsContainer: {
    marginBottom: modernStyles.spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    marginHorizontal: modernStyles.spacing.xs,
    padding: modernStyles.spacing.md,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: modernStyles.spacing.sm,
  },
  statTitle: {
    marginLeft: modernStyles.spacing.xs,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: modernStyles.spacing.xs,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    marginLeft: 4,
    fontSize: 10,
    color: modernColors.success,
    fontWeight: '600',
  },
  recentContainer: {
    flex: 1,
  },
  serviceCard: {
    width: width * 0.7,
    marginRight: modernStyles.spacing.md,
    padding: modernStyles.spacing.lg,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: modernStyles.spacing.sm,
  },
  serviceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: modernStyles.spacing.sm,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  serviceDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: modernStyles.spacing.md,
    lineHeight: 20,
  },
  serviceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: modernColors.success,
  },
  serviceRating: {
    marginLeft: 4,
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
});

export default ModernHomeScreen;

