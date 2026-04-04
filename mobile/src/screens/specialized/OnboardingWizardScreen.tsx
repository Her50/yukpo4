// OnboardingWizardScreen.tsx
// Assistant d'onboarding en 3 étapes pour les nouveaux partenaires Yukpo CM
// Étape 1: Connexion comptes sociaux
// Étape 2: Persona & préférences IA
// Étape 3: Premier post généré

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchWithAuth } from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface OnboardingStatus {
  step1_social_accounts: boolean;
  step2_chatbot_config: boolean;
  step3_first_post: boolean;
  completed: boolean;
}

interface PersonaOption {
  key: string;
  label: string;
  icon: string;
  description: string;
}

const PERSONAS: PersonaOption[] = [
  { key: 'shop', label: 'Boutique', icon: '🛍️', description: 'Vente de produits, promotions, catalogue' },
  { key: 'creator', label: 'Créateur', icon: '🎨', description: 'Contenus créatifs, engagement communauté' },
  { key: 'personality', label: 'Personnalité', icon: '⭐', description: 'Marque personnelle, influence, lifestyle' },
  { key: 'enterprise', label: 'Entreprise', icon: '🏢', description: 'B2B, services professionnels, corporate' },
];

const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', color: '#1877F2' },
  { key: 'instagram', label: 'Instagram', color: '#E1306C' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
  { key: 'tiktok', label: 'TikTok', color: '#000000' },
];

// ─── Composant principal ─────────────────────────────────────────────────────
export default function OnboardingWizardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const serviceId: number = route.params?.service_id ?? 0;

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);

  // Étape 2 — Persona
  const [selectedPersona, setSelectedPersona] = useState('shop');
  const [botName, setBotName] = useState('Assistant Yukpo');
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(false);
  const [brandName, setBrandName] = useState('');

  // Étape 3 — Premier post
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatedPost, setGeneratedPost] = useState('');

  // Animation de progression
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep / 2) * 100,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const loadStatus = useCallback(async () => {
    if (!serviceId) return;
    try {
      const res = await fetchWithAuth(`/api/social-ai/onboarding/status/${serviceId}`);
      if (res.ok) {
        const data: OnboardingStatus = await res.json();
        setStatus(data);
        // Reprendre à la bonne étape
        if (!data.step1_social_accounts) setCurrentStep(0);
        else if (!data.step2_chatbot_config) setCurrentStep(1);
        else setCurrentStep(2);
      }
    } catch (_) {}
  }, [serviceId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── Étape 2 : Sauvegarder persona ────────────────────────────────────────
  const savePersonaConfig = async () => {
    setLoading(true);
    try {
      await fetchWithAuth(`/api/social-ai/chatbot/config/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_name: botName,
          account_persona: selectedPersona,
          white_label_enabled: whiteLabelEnabled,
          white_label_brand_name: whiteLabelEnabled ? brandName : null,
          is_active: true,
        }),
      });
      setCurrentStep(2);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 3 : Générer premier post ────────────────────────────────────────
  const generateFirstPost = async () => {
    setGeneratingPost(true);
    try {
      const res = await fetchWithAuth('/api/social-ai/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          product_id: 0,
          platform: 'instagram',
          tone: 'friendly',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedPost(data.content ?? data.text ?? JSON.stringify(data));
      }
    } catch (_) {
    } finally {
      setGeneratingPost(false);
    }
  };

  const finishOnboarding = () => {
    navigation.navigate('SocialAIScreen', { service_id: serviceId });
  };

  // ── Render étapes ─────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Connectez vos réseaux sociaux</Text>
      <Text style={styles.stepSubtitle}>
        Reliez vos comptes pour que l'IA puisse publier, répondre et analyser.
      </Text>

      {PLATFORMS.map(p => (
        <TouchableOpacity
          key={p.key}
          style={[styles.platformRow, { borderLeftColor: p.color }]}
          onPress={() =>
            navigation.navigate('EcommercePartnerConnectScreen', {
              platform: p.key,
              service_id: serviceId,
            })
          }
        >
          <View style={[styles.platformDot, { backgroundColor: p.color }]} />
          <Text style={styles.platformLabel}>{p.label}</Text>
          <Text style={styles.platformAction}>Connecter →</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.btnPrimary} onPress={() => setCurrentStep(1)}>
        <Text style={styles.btnPrimaryText}>Continuer</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setCurrentStep(1)}>
        <Text style={styles.skipText}>Passer cette étape</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Configurez votre assistant IA</Text>
      <Text style={styles.stepSubtitle}>
        Le persona définit le ton et le style de toutes les réponses IA.
      </Text>

      {/* Nom du bot */}
      <Text style={styles.fieldLabel}>Nom de l'assistant</Text>
      <TextInput
        style={styles.input}
        value={botName}
        onChangeText={setBotName}
        placeholder="Ex: Assis Boutique Lolo"
        placeholderTextColor="#aaa"
      />

      {/* Persona */}
      <Text style={styles.fieldLabel}>Type de compte</Text>
      <View style={styles.personaGrid}>
        {PERSONAS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.personaCard, selectedPersona === p.key && styles.personaCardActive]}
            onPress={() => setSelectedPersona(p.key)}
          >
            <Text style={styles.personaIcon}>{p.icon}</Text>
            <Text style={[styles.personaLabel, selectedPersona === p.key && styles.personaLabelActive]}>
              {p.label}
            </Text>
            <Text style={styles.personaDesc}>{p.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* White-label */}
      <TouchableOpacity
        style={styles.switchRow}
        onPress={() => setWhiteLabelEnabled(v => !v)}
      >
        <View>
          <Text style={styles.fieldLabel}>Mode White-Label</Text>
          <Text style={styles.switchDesc}>Masque toute référence à Yukpo dans les réponses IA</Text>
        </View>
        <View style={[styles.toggle, whiteLabelEnabled && styles.toggleOn]}>
          <View style={[styles.toggleThumb, whiteLabelEnabled && styles.toggleThumbOn]} />
        </View>
      </TouchableOpacity>

      {whiteLabelEnabled && (
        <TextInput
          style={styles.input}
          value={brandName}
          onChangeText={setBrandName}
          placeholder="Nom de votre marque"
          placeholderTextColor="#aaa"
        />
      )}

      <TouchableOpacity
        style={[styles.btnPrimary, loading && styles.btnDisabled]}
        onPress={savePersonaConfig}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnPrimaryText}>Enregistrer et continuer</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Votre premier post IA</Text>
      <Text style={styles.stepSubtitle}>
        Générez votre premier contenu automatiquement et lancez votre activité.
      </Text>

      {generatedPost ? (
        <View style={styles.postPreview}>
          <Text style={styles.postPreviewLabel}>Aperçu du post</Text>
          <ScrollView style={styles.postPreviewScroll}>
            <Text style={styles.postText}>{generatedPost}</Text>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyPost}>
          <Text style={styles.emptyPostIcon}>✨</Text>
          <Text style={styles.emptyPostText}>Appuyez pour générer votre premier post IA</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.btnPrimary, generatingPost && styles.btnDisabled]}
        onPress={generateFirstPost}
        disabled={generatingPost}
      >
        {generatingPost ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnPrimaryText}>
            {generatedPost ? 'Regénérer' : 'Générer un post'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={finishOnboarding}>
        <Text style={styles.btnSecondaryText}>
          {generatedPost ? 'Terminer et aller au tableau de bord' : 'Ignorer et continuer'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const steps = ['Comptes', 'Assistant', 'Premier post'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuration Yukpo</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Barre de progression */}
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Indicateurs étapes */}
      <View style={styles.stepsRow}>
        {steps.map((label, i) => (
          <View key={i} style={styles.stepIndicator}>
            <View style={[styles.stepDot, i <= currentStep && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, i <= currentStep && styles.stepDotTextActive]}>
                {i < currentStep ? '✓' : String(i + 1)}
              </Text>
            </View>
            <Text style={[styles.stepLabel, i === currentStep && styles.stepLabelActive]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Contenu de l'étape */}
      <View style={styles.content}>
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const PRIMARY = '#6C5CE7';
const SURFACE = '#1E1E2E';
const CARD = '#2A2A3E';
const TEXT = '#FFFFFF';
const MUTED = '#888';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  backBtn: { padding: 8 },
  backText: { color: TEXT, fontSize: 22 },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },

  progressBar: {
    height: 4,
    backgroundColor: CARD,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },

  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepIndicator: { alignItems: 'center', gap: 6 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: MUTED,
  },
  stepDotActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  stepDotText: { color: MUTED, fontSize: 13, fontWeight: '700' },
  stepDotTextActive: { color: TEXT },
  stepLabel: { color: MUTED, fontSize: 11 },
  stepLabelActive: { color: TEXT, fontWeight: '600' },

  content: { flex: 1, paddingHorizontal: 20 },
  stepContent: { flex: 1, paddingTop: 8 },
  stepTitle: { color: TEXT, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  stepSubtitle: { color: MUTED, fontSize: 14, marginBottom: 24, lineHeight: 20 },

  // Plateformes
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  platformDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  platformLabel: { color: TEXT, fontSize: 16, fontWeight: '600', flex: 1 },
  platformAction: { color: PRIMARY, fontSize: 14 },

  // Persona
  personaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  personaCard: {
    width: '47%',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  personaCardActive: { borderColor: PRIMARY },
  personaIcon: { fontSize: 28, marginBottom: 6 },
  personaLabel: { color: MUTED, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  personaLabelActive: { color: TEXT },
  personaDesc: { color: MUTED, fontSize: 11, lineHeight: 15 },

  // Formulaire
  fieldLabel: { color: TEXT, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 14,
    color: TEXT,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },

  // Toggle white-label
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  switchDesc: { color: MUTED, fontSize: 11, marginTop: 2, maxWidth: '80%' },
  toggle: {
    width: 48,
    height: 26,
    backgroundColor: '#333',
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: PRIMARY },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TEXT,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // Premier post
  emptyPost: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  emptyPostIcon: { fontSize: 48, marginBottom: 12 },
  emptyPostText: { color: MUTED, fontSize: 14, textAlign: 'center' },
  postPreview: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    maxHeight: 200,
  },
  postPreviewLabel: { color: PRIMARY, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  postPreviewScroll: { maxHeight: 150 },
  postText: { color: TEXT, fontSize: 14, lineHeight: 20 },

  // Boutons
  btnPrimary: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  btnPrimaryText: { color: TEXT, fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnSecondaryText: { color: PRIMARY, fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  skipText: { color: MUTED, textAlign: 'center', fontSize: 13, paddingVertical: 8 },
});
