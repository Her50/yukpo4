// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const AIHubScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguageSafe();

  const aiFeatures = [
    {
      title: t('ai.featureChatTitle'),
      description: t('ai.featureChatDesc'),
      icon: '??',
      onPress: () => navigation.navigate('AIChat' as never),
    },
    {
      title: t('ai.featureSearchTitle'),
      description: t('ai.featureSearchDesc'),
      icon: '??',
      onPress: () => navigation.navigate('Search' as never),
    },
    {
      title: t('ai.featureCreateTitle'),
      description: t('ai.featureCreateDesc'),
      icon: '??',
      onPress: () => navigation.navigate('CreateService' as never),
    },
    {
      title: t('ai.featureSuggestTitle'),
      description: t('ai.featureSuggestDesc'),
      icon: '?',
      onPress: () => { },
    },
  ];

  const quickActions = [
    {
      title: t('ai.quickSearchHairdresser'),
      description: t('ai.quickSearchHairdresserDesc'),
      onPress: () => {
        navigation.navigate('Search' as never);
      },
    },
    {
      title: t('ai.quickCreateCleaning'),
      description: t('ai.quickCreateCleaningDesc'),
      onPress: () => navigation.navigate('CreateService' as never),
    },
    {
      title: t('ai.quickAskHelp'),
      description: t('ai.quickAskHelpDesc'),
      onPress: () => navigation.navigate('AIChat' as never),
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('ai.hubTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('ai.hubSubtitle')}
          </Text>
        </View>

        {/* AI Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ai.featuresTitle')}</Text>
          <View style={styles.featuresGrid}>
            {aiFeatures.map((feature, index) => (
              <TouchableOpacity
                key={index}
                style={styles.featureCard}
                onPress={feature.onPress}
              >
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ai.quickActionsTitle')}</Text>
          {quickActions.map((action, index) => (
            <Card key={index} style={styles.actionCard}>
              <Card.Content>
                <TouchableOpacity onPress={action.onPress}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* AI Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>{t('ai.statsTitle')}</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>1,234</Text>
                <Text style={styles.statLabel}>{t('ai.requestsProcessed')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>98%</Text>
                <Text style={styles.statLabel}>{t('ai.precision')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>2.3s</Text>
                <Text style={styles.statLabel}>{t('ai.avgTime')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Tips */}
        <Card style={styles.tipsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>{t('ai.tipsTitle')}</Text>
            <View style={styles.tipsList}>
              <Text style={styles.tipItem}>• {t('ai.tipPrecise')}</Text>
              <Text style={styles.tipItem}>• {t('ai.tipKeywords')}</Text>
              <Text style={styles.tipItem}>• {t('ai.tipLearns')}</Text>
              <Text style={styles.tipItem}>• {t('ai.tipRephrase')}</Text>
            </View>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionCard: {
    marginBottom: 12,
    elevation: 2,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
  },
  statsCard: {
    marginBottom: 24,
    elevation: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  tipsCard: {
    elevation: 2,
  },
  tipsList: {
    marginTop: 8,
  },
  tipItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
});

export default AIHubScreen;




