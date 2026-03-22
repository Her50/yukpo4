/**
 * Raccourcis vers les écrans IA / recherche / création.
 * Les liens contextuels « Accéder à » sont surtout proposés depuis le chat intelligent — pas de doublon marketing ici.
 */
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from 'react-native-paper';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { modernColors } from '../../theme/modernTheme';

const AIHubScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguageSafe();

  const aiFeatures = [
    {
      title: t('ai.featureChatTitle'),
      description: t('ai.featureChatDesc'),
      emoji: '💬',
      onPress: () => navigation.navigate('AIChat' as never),
    },
    {
      title: t('ai.featureSearchTitle'),
      description: t('ai.featureSearchDesc'),
      emoji: '🔍',
      onPress: () => navigation.navigate('Search' as never),
    },
    {
      title: t('ai.featureCreateTitle'),
      description: t('ai.featureCreateDesc'),
      emoji: '✨',
      onPress: () => navigation.navigate('CreateService' as never),
    },
    {
      title: t('ai.featureSuggestTitle'),
      description: t('ai.featureSuggestDesc'),
      emoji: '🎯',
      onPress: () => navigation.navigate('Match' as never),
    },
  ];

  const quickActions = [
    {
      title: t('ai.quickSearchHairdresser'),
      description: t('ai.quickSearchHairdresserDesc'),
      onPress: () => navigation.navigate('Search' as never),
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentInset}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('ai.hubTitle')}</Text>
          <Text style={styles.subtitle}>{t('ai.hubSubtitle')}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t('ai.featuresTitle')}</Text>
        <View style={styles.featuresGrid}>
          {aiFeatures.map((feature, index) => (
            <TouchableOpacity
              key={index}
              style={styles.featureCard}
              onPress={feature.onPress}
              activeOpacity={0.85}
            >
              <Text style={styles.featureEmoji} accessibilityLabel={feature.title}>
                {feature.emoji}
              </Text>
              <Text style={styles.featureTitle} numberOfLines={2}>
                {feature.title}
              </Text>
              <Text style={styles.featureDescription} numberOfLines={3}>
                {feature.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.sectionSpaced]}>{t('ai.quickActionsTitle')}</Text>
        {quickActions.map((action, index) => (
          <Card key={index} style={styles.actionCard}>
            <Card.Content style={styles.actionCardInner}>
              <TouchableOpacity onPress={action.onPress} activeOpacity={0.85}>
                <Text style={styles.actionTitle} numberOfLines={2}>
                  {action.title}
                </Text>
                <Text style={styles.actionDescription} numberOfLines={3}>
                  {action.description}
                </Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>
        ))}

        <Card style={styles.hintCard}>
          <Card.Content>
            <Text style={styles.hintTitle}>💡 {t('ai.tipsTitle')}</Text>
            <Text style={styles.hintBody}>{t('ai.hubChatHint')}</Text>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  contentInset: {
    paddingBottom: 32,
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: modernColors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: modernColors.text,
  },
  sectionSpaced: {
    marginTop: 8,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: modernColors.surface,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: modernColors.surfaceVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 148,
    justifyContent: 'flex-start',
  },
  featureEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    color: modernColors.text,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    color: modernColors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionCard: {
    marginBottom: 10,
    backgroundColor: modernColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: modernColors.surfaceVariant,
  },
  actionCardInner: {
    paddingVertical: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 6,
  },
  actionDescription: {
    fontSize: 14,
    color: modernColors.textSecondary,
    lineHeight: 20,
  },
  hintCard: {
    marginTop: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  hintTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 8,
  },
  hintBody: {
    fontSize: 14,
    color: modernColors.textSecondary,
    lineHeight: 21,
  },
});

export default AIHubScreen;
