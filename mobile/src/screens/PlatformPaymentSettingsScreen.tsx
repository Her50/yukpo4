// ✅ NOUVEAU 2026-03-11 : Écran admin pour gérer les numéros Mobile Money de la plateforme
// Accessible uniquement aux admin et super-admin
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { NativeButton } from '../components/NativeDesign';
import { NativeInput } from '../components/SafeNativeDesign';
import SafeIcon from '../components/SafeIcon';
import { apiGet, apiPut } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface PlatformSetting {
  id: number;
  key: string;
  value: any;
  description: string | null;
  updated_by: number | null;
  updated_at: string | null;
}

const PlatformPaymentSettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
      const { t } = useLanguageSafe();
const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // MTN Money
  const [mtnPhone, setMtnPhone] = useState('');
  const [mtnMerchantId, setMtnMerchantId] = useState('');
  const [mtnEnabled, setMtnEnabled] = useState(false);

  // Orange Money
  const [orangePhone, setOrangePhone] = useState('');
  const [orangeMerchantId, setOrangeMerchantId] = useState('');
  const [orangeEnabled, setOrangeEnabled] = useState(false);

  // Compte bancaire
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankEnabled, setBankEnabled] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet('/api/admin/platform-settings');
      const data = (response as any)?.data?.data || (response as any)?.data || [];
      const settings: PlatformSetting[] = Array.isArray(data) ? data : [];

      for (const setting of settings) {
        const val = setting.value || {};
        switch (setting.key) {
          case 'platform_mtn_money':
            setMtnPhone(val.phone || '');
            setMtnMerchantId(val.merchant_id || '');
            setMtnEnabled(val.enabled || false);
            break;
          case 'platform_orange_money':
            setOrangePhone(val.phone || '');
            setOrangeMerchantId(val.merchant_id || '');
            setOrangeEnabled(val.enabled || false);
            break;
          case 'platform_bank_account':
            setBankName(val.bank_name || '');
            setBankAccount(val.account_number || '');
            setBankIban(val.iban || '');
            setBankEnabled(val.enabled || false);
            break;
        }
      }
    } catch (err: any) {
      console.error('[PlatformPaymentSettings] Erreur chargement:', err);
      Alert.alert('Erreur', t('platformPaymentSettingsScreen.impossibleDeChargerLesParametresVerifiez'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSetting = async (key: string, value: any) => {
    try {
      await apiPut(`/api/admin/platform-settings/${key}`, { value });
      return true;
    } catch (err: any) {
      console.error(`[PlatformPaymentSettings] Erreur sauvegarde ${key}:`, err);
      return false;
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const results = await Promise.all([
        saveSetting('platform_mtn_money', {
          phone: mtnPhone.trim(),
          merchant_id: mtnMerchantId.trim(),
          enabled: mtnEnabled,
        }),
        saveSetting('platform_orange_money', {
          phone: orangePhone.trim(),
          merchant_id: orangeMerchantId.trim(),
          enabled: orangeEnabled,
        }),
        saveSetting('platform_bank_account', {
          bank_name: bankName.trim(),
          account_number: bankAccount.trim(),
          iban: bankIban.trim(),
          enabled: bankEnabled,
        }),
      ]);

      if (results.every(Boolean)) {
        Alert.alert(t('platformPaymentSettingsScreen.sauvegarde'), t('platformPaymentSettingsScreen.lesParametresDePaiementDeLa'));
      } else {
        Alert.alert('Erreur partielle', t('platformPaymentSettingsScreen.certainsParametresNt('platformPaymentSettingsScreen.ontPasPuEtreSauvegardes'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={modernColors.primary} />
        <Text style={styles.loadingText}>{t('platformPaymentSettings.chargementDesParametres')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Comptes de paiement plateforme</Text>
      <Text style={styles.subtitle}>
        Configurez les numéros Mobile Money et comptes bancaires de la plateforme.
        Les paiements de tokens seront dirigés vers ces comptes.
      </Text>

      {/* MTN Money */}
      <View style={[styles.section, mtnEnabled && styles.sectionActiveMtn]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionEmoji}>📱</Text>
            <Text style={[styles.sectionTitle, mtnEnabled && { color: '#B45309' }]}>MTN Mobile Money</Text>
          </View>
          <Switch
            value={mtnEnabled}
            onValueChange={setMtnEnabled}
            trackColor={{ false: '#E5E7EB', true: '#FBBF24' }}
            thumbColor={mtnEnabled ? '#F59E0B' : '#9CA3AF'}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('platformPaymentSettings.numeroDeTelephoneMtn')}</Text>
          <NativeInput
            placeholder="Ex: 670 XX XX XX"
            value={mtnPhone}
            onChangeText={setMtnPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>ID Marchand MTN (optionnel)</Text>
          <NativeInput
            placeholder="Ex: YUKPO_MTN_001"
            value={mtnMerchantId}
            onChangeText={setMtnMerchantId}
            style={styles.input}
          />
        </View>
      </View>

      {/* Orange Money */}
      <View style={[styles.section, orangeEnabled && styles.sectionActiveOrange]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionEmoji}>📱</Text>
            <Text style={[styles.sectionTitle, orangeEnabled && { color: '#C2410C' }]}>Orange Money</Text>
          </View>
          <Switch
            value={orangeEnabled}
            onValueChange={setOrangeEnabled}
            trackColor={{ false: '#E5E7EB', true: '#FDBA74' }}
            thumbColor={orangeEnabled ? '#F97316' : '#9CA3AF'}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('platformPaymentSettings.numeroDeTelephoneOrange')}</Text>
          <NativeInput
            placeholder="Ex: 690 XX XX XX"
            value={orangePhone}
            onChangeText={setOrangePhone}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>ID Marchand Orange (optionnel)</Text>
          <NativeInput
            placeholder="Ex: YUKPO_ORANGE_001"
            value={orangeMerchantId}
            onChangeText={setOrangeMerchantId}
            style={styles.input}
          />
        </View>
      </View>

      {/* Compte bancaire */}
      <View style={[styles.section, bankEnabled && styles.sectionActiveBank]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionEmoji}>🏦</Text>
            <Text style={[styles.sectionTitle, bankEnabled && { color: '#1D4ED8' }]}>{t('platformPaymentSettings.compteBancaire')}</Text>
          </View>
          <Switch
            value={bankEnabled}
            onValueChange={setBankEnabled}
            trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
            thumbColor={bankEnabled ? '#3B82F6' : '#9CA3AF'}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('platformPaymentSettings.nomDeLaBanque')}</Text>
          <NativeInput
            placeholder="Ex: Afriland First Bank"
            value={bankName}
            onChangeText={setBankName}
            style={styles.input}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('platformPaymentSettings.numeroDeCompte')}</Text>
          <NativeInput
            placeholder={t('platformPaymentSettings.numeroDeCompte')}
            value={bankAccount}
            onChangeText={setBankAccount}
            style={styles.input}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>IBAN (optionnel)</Text>
          <NativeInput
            placeholder="IBAN"
            value={bankIban}
            onChangeText={setBankIban}
            style={styles.input}
          />
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoBox}>
        <SafeIcon name="info" size={20} color={modernColors.primary} />
        <Text style={styles.infoText}>
          Quand un utilisateur achète des tokens via MTN Money, le paiement est dirigé vers le numéro
          MTN Money de la plateforme. Idem pour Orange Money. Le système dispatche automatiquement
          selon le mode de paiement choisi par l'utilisateur.
        </Text>
      </View>

      {/* Bouton Sauvegarder */}
      <NativeButton
        title={saving ? 'Sauvegarde en cours...' : t('platformPaymentSettingsScreen.sauvegarderLesParametres')}
        onPress={handleSaveAll}
        disabled={saving}
        style={styles.saveButton}
      />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: modernColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    lineHeight: 20,
  },
  section: {
    backgroundColor: modernColors.surface,
    borderWidth: 1.5,
    borderColor: modernColors.border,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  sectionActiveMtn: {
    borderColor: '#FBBF24',
    backgroundColor: '#FFFBEB',
  },
  sectionActiveOrange: {
    borderColor: '#F97316',
    backgroundColor: '#FFF7ED',
  },
  sectionActiveBank: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionEmoji: {
    fontSize: 26,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: modernColors.textSecondary,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: modernColors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: modernColors.text,
    backgroundColor: '#FFFFFF',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: modernColors.primary + '10',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: modernColors.primary + '30',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: modernColors.textSecondary,
    lineHeight: 19,
  },
  saveButton: {
    marginTop: 8,
  },
});

export default PlatformPaymentSettingsScreen;
