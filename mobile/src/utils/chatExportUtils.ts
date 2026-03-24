import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Linking, Platform, Share } from 'react-native';

/** Signature obligatoire pour tout partage / export de contenu Yukpo IA vers l’extérieur */
export const YUKPO_IA_SHARE_FOOTER =
  '\n\n—\nRéponse générée par Yukpo IA · https://yukpomnang.com';

export function appendYukpoIaShareFooter(body: string): string {
  const t = String(body || '').trimEnd();
  if (!t) return `Yukpo IA${YUKPO_IA_SHARE_FOOTER}`;
  if (t.includes('Yukpo IA') && t.includes('yukpomnang.com')) return t;
  return `${t}${YUKPO_IA_SHARE_FOOTER}`;
}

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

/** Nom de fichier lisible (sans extension), à partir du contenu ou d’un libellé court. */
export function buildExportBaseNameFromChat(text: string, fallback = 'reponse-yukpo-ia'): string {
  const plain = stripSimpleMarkdownForExport(String(text || ''));
  const firstLine = plain.split(/\n/).map((l) => l.trim()).find(Boolean) || '';
  let s = firstLine
    .replace(/📎\s*×\s*\d+/gi, '')
    .replace(/[^\p{L}\p{N}\s\-_.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 56);
  if (!s) s = fallback;
  s = s
    .replace(/\s+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .toLowerCase();
  if (!s) s = fallback;
  return s;
}

function escapeHtmlForExport(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** RTF minimal (Word ouvre le fichier .doc) — \u signé 16 bits pour accents / emoji BMP. */
function buildRtfFromPlainText(plain: string): string {
  let body = '';
  for (let i = 0; i < plain.length; ) {
    const c = plain.codePointAt(i)!;
    const w = c > 0xffff ? 2 : 1;
    i += w;

    if (c === 0x0a || c === 0x0d) {
      if (c === 0x0d && plain.codePointAt(i) === 0x0a) i += 1;
      body += '\\par\n';
      continue;
    }
    if (c === 0x5c) {
      body += '\\\\';
      continue;
    }
    if (c === 0x7b) {
      body += '\\{';
      continue;
    }
    if (c === 0x7d) {
      body += '\\}';
      continue;
    }
    if (c < 128) {
      body += String.fromCodePoint(c);
      continue;
    }
    if (c > 0xffff) {
      const H = Math.floor((c - 0x10000) / 0x400) + 0xd800;
      const L = ((c - 0x10000) % 0x400) + 0xdc00;
      const h = H > 32767 ? H - 65536 : H;
      const l = L > 32767 ? L - 65536 : L;
      body += `\\u${h}\\?\\u${l}\\?`;
    } else {
      const u = c > 32767 ? c - 65536 : c;
      body += `\\u${u}\\?`;
    }
  }
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs24 ${body}\\par}`;
}

/** Export PDF via expo-print (partage système). */
export async function exportChatTextAsPdf(
  text: string,
  baseName: string,
  options?: { withYukpoIaFooter?: boolean },
): Promise<void> {
  const withFooter = options?.withYukpoIaFooter !== false;
  const plain = stripSimpleMarkdownForExport(text);
  const full = withFooter ? appendYukpoIaShareFooter(plain) : plain;
  const safeName = buildExportBaseNameFromChat(full, baseName);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;font-size:15px;line-height:1.55;color:#111}pre{white-space:pre-wrap;font-family:inherit;margin:0}</style></head><body><pre>${escapeHtmlForExport(
    full,
  )}</pre></body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  const fileName = `${safeName}.pdf`;
  const target = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.copyAsync({ from: uri, to: target });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, { mimeType: 'application/pdf', dialogTitle: 'PDF — Yukpo IA' });
  } else {
    await Share.share({ message: full, title: fileName });
  }
}

/** Export Word-compatible (.doc RTF) puis partage. */
export async function exportChatTextAsWordDoc(
  text: string,
  baseName: string,
  options?: { withYukpoIaFooter?: boolean },
): Promise<void> {
  const withFooter = options?.withYukpoIaFooter !== false;
  const plain = stripSimpleMarkdownForExport(text);
  const full = withFooter ? appendYukpoIaShareFooter(plain) : plain;
  const safeName = buildExportBaseNameFromChat(full, baseName);
  const rtf = buildRtfFromPlainText(full);
  const fileName = `${safeName}.doc`;
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, rtf, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/msword',
      dialogTitle: 'Word — Yukpo IA',
    });
  } else {
    await Share.share({ message: full, title: fileName });
  }
}

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
  options?: { withYukpoIaFooter?: boolean },
): Promise<void> {
  const withFooter = options?.withYukpoIaFooter !== false;
  const plain = format === 'md' ? String(text || '') : stripSimpleMarkdownForExport(text);
  const ext = format === 'csv' ? 'csv' : format === 'md' ? 'md' : 'txt';
  const mime =
    format === 'csv' ? 'text/csv' : format === 'md' ? 'text/markdown' : 'text/plain';

  let body = plain;
  if (format === 'csv') {
    const cell = plain.replace(/"/g, '""');
    body = `"Yukpo — réponse assistant"\n"${cell}"`;
  }
  if (withFooter && format !== 'csv') {
    body = appendYukpoIaShareFooter(body);
  } else if (withFooter && format === 'csv') {
    body = `${body}\n"Signature","Yukpo IA — https://yukpomnang.com"`;
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
