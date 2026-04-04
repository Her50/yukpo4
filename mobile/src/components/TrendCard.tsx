// TrendCard — Composant réutilisable Yukpo TrendPulse
// Utilisé dans : IntelligentChat (messages), TrendPulseDashboardScreen, ResultatBesoinScreen (inline)
// Affiche une tendance avec ses produits matchants et l'action recommandée

import React, { useCallback, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import SafeIcon from './SafeIcon';
import { modernColors } from '../theme/modernTheme';

// ─── Types (miroir du backend TrendItem) ─────────────────────────────────────

export interface TrendMatchingProduct {
  product_id: number;
  product_name: string;
  service_id: number;
  service_name: string;
  match_score: number;
  current_price: number;
  is_promo: boolean;
}

export interface TrendRecommendedAction {
  action_type: string;
  title: string;
  description: string;
  estimated_roas?: number;
  suggested_budget_fcfa?: number;
  route?: string;
  route_params?: any;
}

export interface TrendItemData {
  id: string;
  topic: string;
  social_score: number;
  commerce_score: number;
  opportunity_score: number;
  momentum_pct: number;
  categories: string[];
  regions: string[];
  sources: string[];
  period: string;
  matching_products: TrendMatchingProduct[];
  recommended_action?: TrendRecommendedAction;
}

interface TrendCardProps {
  trend: TrendItemData;
  /** Mode compact pour les listes (inline dans ResultatBesoin) */
  compact?: boolean;
  /** Mode chat : affiché dans IntelligentChat, style légèrement différent */
  inChat?: boolean;
  onActionPress?: (action: TrendRecommendedAction) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#ef4444'; // rouge — explosif
  if (score >= 60) return '#f97316'; // orange — fort
  if (score >= 40) return '#eab308'; // jaune — modéré
  return '#6b7280';                  // gris — faible
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Explosif';
  if (score >= 60) return 'Fort';
  if (score >= 40) return 'Modéré';
  return 'Émergent';
}

function momentumIcon(pct: number): string {
  if (pct >= 100) return 'trending-up';
  if (pct >= 50) return 'arrow-up-right';
  if (pct >= 0) return 'arrow-right';
  return 'arrow-down-right';
}

function actionIcon(actionType: string): string {
  switch (actionType) {
    case 'launch_campaign': return 'megaphone';
    case 'schedule_post': return 'calendar';
    case 'create_promo': return 'tag';
    default: return 'zap';
  }
}

// ─── Composant ────────────────────────────────────────────────────────────────

const TrendCard: React.FC<TrendCardProps> = ({
  trend,
  compact = false,
  inChat = false,
  onActionPress,
}) => {
  const navigation = useNavigation();
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(trend.opportunity_score);
  const hasProducts = trend.matching_products.length > 0;
  const hasAction = !!trend.recommended_action;

  const handleAction = useCallback(() => {
    if (!trend.recommended_action) return;
    if (onActionPress) {
      onActionPress(trend.recommended_action);
      return;
    }
    // Navigation directe si route fournie
    if (trend.recommended_action.route) {
      (navigation as any).navigate(
        trend.recommended_action.route,
        trend.recommended_action.route_params || {},
      );
    }
  }, [trend.recommended_action, navigation, onActionPress]);

  if (compact) {
    return (
      <View style={[styles.compactCard, { borderLeftColor: color }]}>
        <View style={styles.compactHeader}>
          <SafeIcon name="trending-up" size={14} color={color} type="lucide" />
          <Text style={[styles.compactTopic]} numberOfLines={1}>
            {trend.topic}
          </Text>
          <View style={[styles.scorePill, { backgroundColor: color }]}>
            <Text style={styles.scorePillText}>{Math.round(trend.opportunity_score)}</Text>
          </View>
        </View>
        {hasProducts && (
          <Text style={styles.compactProducts} numberOfLines={1}>
            {trend.matching_products.map(p => p.product_name).join(' · ')}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.card, inChat && styles.cardInChat]}>
      {/* En-tête */}
      <View style={styles.header}>
        <View style={[styles.scoreBadge, { backgroundColor: color + '18' }]}>
          <SafeIcon name="flame" size={13} color={color} type="lucide" />
          <Text style={[styles.scoreText, { color }]}>
            {scoreLabel(trend.opportunity_score)} · {Math.round(trend.opportunity_score)}/100
          </Text>
        </View>
        <View style={styles.momentumRow}>
          <SafeIcon
            name={momentumIcon(trend.momentum_pct)}
            size={13}
            color={trend.momentum_pct >= 50 ? '#22c55e' : '#9ca3af'}
            type="lucide"
          />
          <Text style={[
            styles.momentumText,
            { color: trend.momentum_pct >= 50 ? '#22c55e' : '#9ca3af' },
          ]}>
            +{Math.round(trend.momentum_pct)}%
          </Text>
        </View>
      </View>

      {/* Sujet tendance */}
      <Text style={styles.topic} numberOfLines={2}>{trend.topic}</Text>

      {/* Sources + régions */}
      <View style={styles.metaRow}>
        {trend.sources.slice(0, 3).map((src, i) => (
          <View key={i} style={styles.sourceChip}>
            <Text style={styles.sourceText}>{src}</Text>
          </View>
        ))}
        {trend.regions.length > 0 && (
          <View style={styles.regionChip}>
            <SafeIcon name="map-pin" size={10} color="#6b7280" type="lucide" />
            <Text style={styles.regionText}>{trend.regions.slice(0, 2).join(', ')}</Text>
          </View>
        )}
      </View>

      {/* Score bars */}
      <View style={styles.barsContainer}>
        <ScoreBar label="Social" score={trend.social_score} color="#6366f1" />
        {trend.commerce_score > 0 && (
          <ScoreBar label="Commerce Yukpo" score={trend.commerce_score} color="#f97316" />
        )}
      </View>

      {/* Produits matchants */}
      {hasProducts && (
        <View style={styles.productsSection}>
          <View style={styles.productsSectionHeader}>
            <SafeIcon name="package" size={13} color="#f97316" type="lucide" />
            <Text style={styles.productsSectionLabel}>
              {trend.matching_products.length} produit{trend.matching_products.length > 1 ? 's' : ''} de ton catalogue correspondent
            </Text>
          </View>
          {(expanded ? trend.matching_products : trend.matching_products.slice(0, 2)).map((p, i) => (
            <View key={i} style={styles.productRow}>
              <Text style={styles.productName} numberOfLines={1}>{p.product_name}</Text>
              <View style={styles.productMeta}>
                {p.is_promo && (
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeText}>PROMO</Text>
                  </View>
                )}
                <Text style={styles.productPrice}>{p.current_price.toLocaleString()} FCFA</Text>
              </View>
            </View>
          ))}
          {trend.matching_products.length > 2 && (
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
              <Text style={styles.expandBtnText}>
                {expanded ? 'Voir moins' : `+${trend.matching_products.length - 2} autres`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Action recommandée */}
      {hasAction && trend.recommended_action && (
        <TouchableOpacity style={styles.actionBtn} onPress={handleAction} activeOpacity={0.82}>
          <SafeIcon
            name={actionIcon(trend.recommended_action.action_type)}
            size={14}
            color="#ffffff"
            type="lucide"
          />
          <View style={styles.actionTextBlock}>
            <Text style={styles.actionTitle} numberOfLines={1}>
              {trend.recommended_action.title}
            </Text>
            {trend.recommended_action.estimated_roas && (
              <Text style={styles.actionSub}>
                ROAS estimé : {trend.recommended_action.estimated_roas.toFixed(1)}x
                {trend.recommended_action.suggested_budget_fcfa
                  ? ` · Budget : ${trend.recommended_action.suggested_budget_fcfa.toLocaleString()} FCFA`
                  : ''}
              </Text>
            )}
          </View>
          <SafeIcon name="chevron-right" size={16} color="#ffffff" type="lucide" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Sous-composant barre de score ────────────────────────────────────────────

const ScoreBar: React.FC<{ label: string; score: number; color: string }> = ({
  label, score, color,
}) => (
  <View style={styles.barRow}>
    <Text style={styles.barLabel}>{label}</Text>
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.round(score)}%` as any, backgroundColor: color }]} />
    </View>
    <Text style={[styles.barValue, { color }]}>{Math.round(score)}</Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardInChat: {
    backgroundColor: '#fafafa',
    borderColor: '#e2e8f0',
    marginHorizontal: 0,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '700',
  },
  momentumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  momentumText: {
    fontSize: 11,
    fontWeight: '600',
  },
  topic: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 10,
  },
  sourceChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sourceText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  regionText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  barsContainer: {
    gap: 5,
    marginBottom: 10,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    fontSize: 10,
    color: '#94a3b8',
    width: 90,
  },
  barTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 5,
    borderRadius: 3,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '700',
    width: 24,
    textAlign: 'right',
  },
  productsSection: {
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  productsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  productsSectionLabel: {
    fontSize: 11,
    color: '#c2410c',
    fontWeight: '600',
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa40',
  },
  productName: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '500',
    flex: 1,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  promoBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  promoBadgeText: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '700',
  },
  productPrice: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  expandBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  expandBtnText: {
    fontSize: 11,
    color: '#f97316',
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 10,
    padding: 11,
    gap: 10,
  },
  actionTextBlock: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  actionSub: {
    fontSize: 10,
    color: '#c7d2fe',
    marginTop: 1,
  },
  // Compact mode
  compactCard: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 8,
    marginVertical: 3,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactTopic: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  scorePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  scorePillText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
  },
  compactProducts: {
    fontSize: 10,
    color: '#92400e',
    marginTop: 3,
    fontStyle: 'italic',
  },
});

export default TrendCard;
