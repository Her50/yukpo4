/**
 * Pièces jointes YukpoIA → champ `context.yukpo_ia_attachments` pour POST /ai/chat`
 *
 * Référence : **`ChatInputMobile.tsx`** envoie déjà audio (base64 via expo-av) et PDF (base64)
 * dans d'autres payloads (`audio_base64`, `pdf_base64`) — sans STT ni extraction texte PDF en local.
 * Ici on couvre le contrat YukpoIA : image + fichier texte (extrait lu côté app)
 * ; audio/PDF binaire peuvent être branchés de la même manière que ChatInputMobile si besoin.
 */
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export type YukpoIaAttachmentPayload = {
  kind: 'image' | 'file' | 'audio';
  mime: string;
  name?: string;
  data_base64?: string;
  extracted_text?: string;
  transcript?: string;
};

/**
 * expo-image-picker ne renvoie pas toujours `base64` (galerie Android, grosses images, certains HEIC).
 * On lit alors le fichier local en base64 — même stratégie que l'audio dans stopAudioRecordingForYukpoIa.
 */
async function readImageBase64FromPickerAsset(a: ImagePicker.ImagePickerAsset): Promise<string | null> {
  if (a.base64) {
    return a.base64;
  }
  if (!a.uri) {
    return null;
  }
  const read = async (uri: string) =>
    FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

  try {
    return await read(a.uri);
  } catch {
    // Android : parfois content:// illisible directement → copie en cache puis lecture
    if (a.uri.startsWith('content://') && FileSystem.cacheDirectory) {
      const dest = `${FileSystem.cacheDirectory}yukpo_ia_pick_${Date.now()}.bin`;
      try {
        await FileSystem.copyAsync({ from: a.uri, to: dest });
        return await read(dest);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function pickImageForYukpoIa(): Promise<YukpoIaAttachmentPayload | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.82,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const mime = a.mimeType || 'image/jpeg';
  const dataBase64 = await readImageBase64FromPickerAsset(a);
  if (!dataBase64) return null;
  return { kind: 'image', mime, data_base64: dataBase64 };
}

/** Photo directe depuis l'appareil photo (chat Yukpo IA). */
export async function takePhotoForYukpoIa(): Promise<YukpoIaAttachmentPayload | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.82,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const mime = a.mimeType || 'image/jpeg';
  const dataBase64 = await readImageBase64FromPickerAsset(a);
  if (!dataBase64) return null;
  return { kind: 'image', mime, data_base64: dataBase64, name: `photo_${Date.now()}.jpg` };
}

export async function pickDocumentForYukpoIa(): Promise<YukpoIaAttachmentPayload | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (!asset?.uri) return null;
  const name = asset.name || 'document';
  const mime = asset.mimeType || 'application/octet-stream';

  const isPlainText =
    mime.startsWith('text/') || /\.(txt|md|csv)$/i.test(name);
  const isPdf = mime.includes('pdf') || /\.pdf$/i.test(name);
  const isOffice =
    mime.includes('spreadsheet') ||
    mime.includes('wordprocessing') ||
    mime.includes('msword') ||
    /\.(xlsx|docx)$/i.test(name);

  if (isPlainText) {
    let extracted = '';
    try {
      extracted = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      extracted = extracted.slice(0, 14000);
    } catch {
      extracted = '';
    }
    return {
      kind: 'file',
      mime,
      name,
      extracted_text: extracted || `[Fichier ${name} — extrait texte non disponible sur cet appareil]`,
    };
  }

  // PDF / bureautique : envoi base64 → extraction côté serveur (pdf-extract / calamine / docx-rs)
  if (isPdf || isOffice) {
    try {
      const dataBase64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const clipped = dataBase64.slice(0, 12_000_000);
      return { kind: 'file', mime, name, data_base64: clipped };
    } catch {
      return {
        kind: 'file',
        mime,
        name,
        extracted_text: `[Fichier ${name} — lecture impossible sur cet appareil]`,
      };
    }
  }

  return {
    kind: 'file',
    mime,
    name,
    extracted_text: `[Fichier ${name} — type non pris en charge pour l'extraction automatique]`,
  };
}

let _activeRecording: Audio.Recording | null = null;

export async function startAudioRecordingForYukpoIa(): Promise<boolean> {
  try {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return false;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    _activeRecording = recording;
    return true;
  } catch {
    _activeRecording = null;
    return false;
  }
}

export async function stopAudioRecordingForYukpoIa(): Promise<YukpoIaAttachmentPayload | null> {
  if (!_activeRecording) return null;
  try {
    await _activeRecording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = _activeRecording.getURI();
    _activeRecording = null;
    if (!uri) return null;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) return null;
    return {
      kind: 'audio',
      mime: 'audio/m4a',
      name: `audio_${Date.now()}.m4a`,
      data_base64: base64,
      transcript: '',
    };
  } catch {
    _activeRecording = null;
    return null;
  }
}

export function cancelAudioRecording(): void {
  if (_activeRecording) {
    _activeRecording.stopAndUnloadAsync().catch(() => { });
    _activeRecording = null;
  }
}

export function isRecordingActive(): boolean {
  return _activeRecording !== null;
}
