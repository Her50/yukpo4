import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Linking, Platform, Share } from 'react-native';

/**
 * Retire un markdown léger (**gras**, listes) pour export texte brut.
 */
export function stripSimpleMarkdownForExport(raw: string): string {
  let s = String(raw || '');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/^[-•]\s+/gm, '');
  return s.trim();
}

export type ChatExportFormat = 'txt' | 'md' | 'csv';

/**
 * Exporte le texte de la réponse dans un fichier local puis ouvre le partage système (expo-sharing).
 */
/**
 * Écrit un objet JSON dans un fichier `.json` dans le cache puis partage (expo-sharing).
 * Préférable au partage texte seul pour les exports RGPD volumineux.
 */
export async function exportJsonObjectAsFile(
  obj: unknown,
  baseName = 'yukpo-ia-export',
): Promise<void> {
  const body = JSON.stringify(obj, null, 2);
  const fileName = `${baseName}-${Date.now()}.json`;
  const uri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(uri, body, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export YukpoIA',
    });
  } else {
    await Share.share({
      message: body,
      title: fileName,
    });
  }
}

export async function exportChatTextAsFile(
  text: string,
  format: ChatExportFormat,
  baseName = 'yukpo-reponse',
): Promise<void> {
  const plain = format === 'md' ? String(text || '') : stripSimpleMarkdownForExport(text);
  const ext = format === 'csv' ? 'csv' : format === 'md' ? 'md' : 'txt';
  const mime =
    format === 'csv' ? 'text/csv' : format === 'md' ? 'text/markdown' : 'text/plain';

  let body = plain;
  if (format === 'csv') {
    const cell = plain.replace(/"/g, '""');
    body = `"Yukpo — réponse assistant"\n"${cell}"`;
  }

  const fileName = `${baseName}-${Date.now()}.${ext}`;
  const uri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(uri, body, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: mime,
      dialogTitle: 'Exporter',
    });
  } else {
    await Share.share({
      message: body,
      title: fileName,
    });
  }
}

/**
 * Ouvre une URL de fichier généré côté backend / stockage (l’IA externe renvoie souvent une URL signée).
 */
export async function openOrDownloadRemoteFile(url: string, filenameHint?: string): Promise<void> {
  const u = String(url || '').trim();
  if (!u) return;
  try {
    const can = await Linking.canOpenURL(u);
    if (can) {
      await Linking.openURL(u);
      return;
    }
  } catch {
    /* continue */
  }

  try {
    const name =
      filenameHint ||
      u.split('/').pop()?.split('?')[0] ||
      `fichier-${Date.now()}`;
    const target = `${FileSystem.cacheDirectory}${name}`;
    const result = await FileSystem.downloadAsync(u, target);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, {
        dialogTitle: name,
        mimeType: undefined,
      });
    } else if (Platform.OS === 'android') {
      await Share.share({ message: u, title: name });
    } else {
      Alert.alert('Téléchargement', 'Impossible d’ouvrir le fichier sur cet appareil.');
    }
  } catch (e) {
    console.warn('[chatExportUtils] download failed', e);
    Alert.alert('Erreur', 'Impossible de récupérer le fichier. Réessayez ou copiez le lien.');
  }
}
