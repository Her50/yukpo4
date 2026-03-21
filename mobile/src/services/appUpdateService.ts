import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Alert, Linking, Platform } from 'react-native';
import { apiCall } from './api';

export interface UpdateCheckRequest {
  current_version_code: number;
  platform: string; // "android" or "ios"
  install_source?: string; // "play_store" | "direct_apk" | "app_store" | "test_flight"
}

export interface AppVersionInfo {
  version_code: number;
  version_name: string;
  download_url: string;
  download_type: 'play_store' | 'direct_apk' | 'app_store' | 'external';
  release_date: string;
  size_bytes: number;
  mandatory: boolean;
  changelog: string[];
  min_supported_version: number;
}

export interface UpdateCheckResponse {
  has_update: boolean;
  update_info?: AppVersionInfo;
  server_time: string;
}

class AppUpdateService {
  private static readonly LAST_CHECK_KEY = '@yukpo_last_update_check';
  private static readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 heures

  /**
   * Vérifie les mises à jour au démarrage de l'app
   */
  async checkForUpdatesOnAppStart(): Promise<void> {
    try {
      const lastCheck = await AsyncStorage.getItem(AppUpdateService.LAST_CHECK_KEY);
      const now = Date.now();

      // Vérifier seulement si 24h se sont écoulées
      if (!lastCheck || (now - parseInt(lastCheck)) > AppUpdateService.CHECK_INTERVAL) {
        await this.performUpdateCheck();
        await AsyncStorage.setItem(AppUpdateService.LAST_CHECK_KEY, now.toString());
      }
    } catch (error) {
      console.warn('[AppUpdate] Erreur vérification automatique:', error);
    }
  }

  /**
   * Vérification manuelle des mises à jour
   */
  async checkForUpdatesManually(): Promise<boolean> {
    try {
      return await this.performUpdateCheck();
    } catch (error) {
      console.error('[AppUpdate] Erreur vérification manuelle:', error);
      return false;
    }
  }

  /**
   * Effectue la vérification de mise à jour
   */
  private async performUpdateCheck(): Promise<boolean> {
    try {
      const currentVersion = Application.nativeApplicationVersion || '1.0.0';
      const buildNumber = Application.nativeBuildVersion || '1';

      // Détecter la source d'installation
      const installSource = await this.detectInstallSource();

      const response = await apiCall<UpdateCheckResponse>('/app/update/check', {
        method: 'POST',
        body: JSON.stringify({
          current_version_code: parseInt(buildNumber) || 1,
          platform: Platform.OS,
          install_source: installSource,
        }),
      });

      if (response?.has_update && response?.update_info) {
        await this.showUpdateDialog(response.update_info);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[AppUpdate] Erreur API:', error);
      return false;
    }
  }

  /**
   * Détecte la source d'installation de l'application
   */
  private async detectInstallSource(): Promise<string> {
    try {
      if (Platform.OS === 'android') {
        const buildNumber = Application.nativeBuildVersion || '1';
        const versionCode = parseInt(buildNumber) || 1;

        // Convention: versions Play Store >= 1000, versions directes < 1000
        if (versionCode >= 1000) {
          return 'play_store';
        } else {
          return 'direct_apk';
        }
      } else if (Platform.OS === 'ios') {
        // iOS peut être App Store ou Test Flight
        const bundleId = Application.applicationId;
        if (bundleId?.includes('testflight')) {
          return 'test_flight';
        } else {
          return 'app_store';
        }
      }

      return 'unknown';
    } catch (error) {
      console.warn('[AppUpdate] Erreur détection source:', error);
      return 'unknown';
    }
  }

  /**
   * Affiche le dialogue de mise à jour
   */
  private async showUpdateDialog(updateInfo: AppVersionInfo): Promise<void> {
    const title = updateInfo.mandatory
      ? '🔄 Mise à jour requise'
      : '📱 Mise à jour disponible';

    const downloadTypeText = this.getDownloadTypeText(updateInfo.download_type);

    const message = `Nouvelle version ${updateInfo.version_name} disponible!\n\n` +
      `📝 Quoi de neuf:\n${updateInfo.changelog.join('\n')}\n\n` +
      `📦 Taille: ${(updateInfo.size_bytes / (1024 * 1024)).toFixed(1)} MB\n` +
      `🔗 Source: ${downloadTypeText}`;

    const buttons: { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [
      {
        text: updateInfo.mandatory ? 'Mettre à jour' : 'Plus tard',
        onPress: () => {
          if (updateInfo.mandatory) {
            this.downloadUpdate(updateInfo.download_url, updateInfo.download_type);
          }
        },
        style: updateInfo.mandatory ? 'default' as const : 'cancel' as const,
      },
    ];

    if (!updateInfo.mandatory) {
      buttons.push({
        text: 'Mettre à jour maintenant',
        onPress: () => this.downloadUpdate(updateInfo.download_url, updateInfo.download_type),
        style: 'default' as const,
      });
    }

    Alert.alert(title, message, buttons, { cancelable: !updateInfo.mandatory });
  }

  /**
   * Récupère le texte pour le type de téléchargement
   */
  private getDownloadTypeText(downloadType: string): string {
    switch (downloadType) {
      case 'play_store':
        return 'Google Play Store';
      case 'direct_apk':
        return 'Téléchargement direct (APK)';
      case 'app_store':
        return 'App Store';
      case 'external':
        return 'Source externe';
      default:
        return 'Source inconnue';
    }
  }

  /**
   * Télécharge la mise à jour
   */
  private async downloadUpdate(downloadUrl: string, downloadType: string): Promise<void> {
    try {
      let url = downloadUrl;

      // Ajouter un timestamp pour éviter le cache (sauf pour Play Store)
      if (downloadType !== 'play_store' && downloadType !== 'app_store') {
        url = `${downloadUrl}?t=${Date.now()}`;
      }

      // Ouvrir selon le type de téléchargement
      if (downloadType === 'play_store') {
        // Ouvrir directement Play Store
        await Linking.openURL(url);
      } else if (downloadType === 'app_store') {
        // Ouvrir directement App Store
        await Linking.openURL(url);
      } else {
        // Téléchargement direct (APK ou externe)
        const supported = await Linking.canOpenURL(url);

        if (supported) {
          await Linking.openURL(url);
        } else {
          console.error('[AppUpdate] URL non supportée:', url);
          Alert.alert('Erreur', 'Impossible d\'ouvrir le lien de téléchargement');
        }
      }
    } catch (error) {
      console.error('[AppUpdate] Erreur téléchargement:', error);
      Alert.alert('Erreur', 'Impossible de télécharger la mise à jour');
    }
  }

  /**
   * Vérifie si la version actuelle est supportée
   */
  async isCurrentVersionSupported(): Promise<boolean> {
    try {
      const buildNumber = Application.nativeBuildVersion || '1';
      const currentVersion = parseInt(buildNumber) || 1;

      const response = await apiCall<AppVersionInfo>('/app/update/info');

      return currentVersion >= response.min_supported_version;
    } catch (error) {
      console.error('[AppUpdate] Erreur vérification support:', error);
      return true; // Par défaut, on considère que c'est supporté
    }
  }

  /**
   * Force la vérification (ignore le délai de 24h)
   */
  async forceCheckForUpdates(): Promise<void> {
    await AsyncStorage.removeItem(AppUpdateService.LAST_CHECK_KEY);
    await this.checkForUpdatesOnAppStart();
  }
}

export const appUpdateService = new AppUpdateService();
