// Écran d'accueil moderne et stable
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const ModernHomeScreen: React.FC = () => {
  const navigation = useNavigation();

  const QuickAction = ({ emoji, title, onPress }: any) => (
    <TouchableOpacity onPress={onPress} style={styles.quickActionContainer}>
      <View style={styles.quickAction}>
        <Text style={styles.quickActionEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  const StatCard = ({ emoji, title, value }: any) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statEmoji}>{emoji}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header moderne */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Bonjour ! 👋</Text>
            <Text style={styles.userName}>Prêt à découvrir ?</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconButton}>
              <Text style={styles.notificationIcon}>🔔</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Barre de recherche moderne - CLIQUABLE */}
        <TouchableOpacity onPress={() => (navigation as any).navigate('Search')}>
          <View style={styles.searchCard}>
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <Text style={styles.searchPlaceholder}>Rechercher un service...</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Actions rapides */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.quickActions}>
            <QuickAction
              emoji="➕"
              title="Créer"
              onPress={() => (navigation as any).navigate('Create')}
            />
            <QuickAction
              emoji="🔍"
              title="Rechercher"
              onPress={() => (navigation as any).navigate('Search')}
            />
            <QuickAction
              emoji="❤️"
              title="Favoris"
              onPress={() => (navigation as any).navigate('Services')}
            />
            <QuickAction
              emoji="📍"
              title="Proche"
              onPress={() => (navigation as any).navigate('Search')}
            />
          </View>
        </View>

        {/* Statistiques */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Vos statistiques</Text>
          <View style={styles.statsGrid}>
            <StatCard
              emoji="👥"
              title="Services"
              value="12"
            />
            <StatCard
              emoji="⭐"
              title="Évaluations"
              value="4.8"
            />
            <StatCard
              emoji="⏰"
              title="Temps moyen"
              value="2h"
            />
          </View>
        </View>

        {/* Services récents */}
        <View style={styles.recentContainer}>
          <Text style={styles.sectionTitle}>Services récents</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[1, 2, 3].map((item) => (
              <View key={item} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceIcon}>
                    <Text style={styles.serviceEmoji}>🏠</Text>
                  </View>
                  <Text style={styles.serviceTitle}>Service {item}</Text>
                </View>
                <Text style={styles.serviceDescription}>
                  Description du service avec détails...
                </Text>
                <View style={styles.serviceFooter}>
                  <Text style={styles.servicePrice}>25€</Text>
                  <Text style={styles.serviceRating}>⭐ 4.8</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
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

