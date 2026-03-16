/**
 * VERSION MINIMALE DE HOMESCREEN POUR DIAGNOSTIC DE CRASH
 * Test progressif des composants pour identifier celui qui cause le crash
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';

const HomeScreenMinimal = () => {
  const { user } = useAuth();
      const { t } = useLanguageSafe();
const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testComponents = async () => {
      try {
        // Étape 1: HomeScreen charge
        console.log('[HomeScreenMinimal] ✅ Étape 1: HomeScreen chargé');
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep(2);

        // Étape 2: Test AuthContext
        console.log('[HomeScreenMinimal] ✅ Étape 2: AuthContext OK, user:', user?.email);
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep(3);

        // Étape 3: Test LanguageContext
        console.log('[HomeScreenMinimal] ✅ Étape 3: Test LanguageContext...');
        // Le useLanguageSafe est déjà appelé au-dessus
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep(4);

        // Étape 4: Test imports de composants (sans les monter)
        console.log('[HomeScreenMinimal] ✅ Étape 4: Test imports composants...');
        
        // Importer les composants un par un pour voir lequel cause le crash
        const imports = [
          () => import('../components/ChatInputMobile'),
          () => import('../components/ModernGPSModal'),
          () => import('../components/NotificationHistoryModal'),
          () => import('../components/UserAvatarMenu'),
          () => import('../components/YukpoServicesQuickAccess'),
        ];

        for (let i = 0; i < imports.length; i++) {
          try {
            console.log(`[HomeScreenMinimal] ✅ Import ${i + 1}/${imports.length}`);
            await imports[i]();
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (importError: any) {
            throw new Error(t('homeScreen.minimal.importEchoue', { i + 1: i + 1, importError_message: importError.message }));
          }
        }

        setStep(5);
        console.log('[HomeScreenMinimal] ✅ TOUS LES COMPOSANTS IMPORTÉS AVEC SUCCÈS !');

      } catch (err: any) {
        const errorMsg = t('homeScreen.minimal.erreurALetape', { step: step, err?_message || String(err): err?.message || String(err) });
        console.error('[HomeScreenMinimal] ❌', errorMsg);
        setError(errorMsg);
      }
    };

    testComponents();
  }, [user]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorTitle}>Crash dans HomeScreen !</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.hint}>
          Le crash se produit à l'étape {step} du HomeScreen.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Yukpomnang</Text>
        <Text style={styles.subtitle}>{t('homeScreen.minimal.modeDiagnosticHomescreen')}/Text>
      </View>

      <View style={styles.content}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.step}>{t('homeScreenMinimal.step')} {step}/5</Text>
        <Text style={styles.description}>
          {step === 1 && 'Chargement de HomeScreen...'}
          {step === 2 && `AuthContext: ${user?.email || t('homeScreen.minimal.utilisateurConnecte')}`}
          {step === 3 && 'Test LanguageContext...'}
          {step === 4 && 'Test des imports de composants...'}
          {step === 5 && '✅ HomeScreen fonctionne !'}
        </Text>

        {step === 5 && (
          <View style={styles.successSection}>
            <Text style={styles.successTitle}>{t('homeScreen.minimal.diagnosticReussi')}</Text>
            <Text style={styles.successText}>
              HomeScreen peut charger tous les composants sans crash.
              Le problème vient probablement d\'un autre écran ou de la navigation.
            </Text>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => console.log('[HomeScreenMinimal] Test navigation...')}
            >
              <Text style={styles.buttonText}>Tester navigation</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#E0E7FF',
    marginTop: 5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  step: {
    fontSize: 18,
    color: '#6366F1',
    marginTop: 20,
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  successSection: {
    marginTop: 40,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 10,
  },
  successText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreenMinimal;
