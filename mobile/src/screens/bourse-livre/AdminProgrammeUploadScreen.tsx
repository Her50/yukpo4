import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSystemeEducatif } from '../../data/educationSystems';
import useUserCountry from '../../hooks/useUserCountry';
import { bourseLivreV2Api, ProgrammeExtractionResult } from '../../services/bourseLivreV2Api';

const NIVEAUX = ['Maternelle', 'Primaire', 'Collège', 'Lycée', 'Université'];
const FICHIER_TYPES = [
  { label: 'PDF', value: 'pdf', icon: 'document-text' },
  { label: 'Excel', value: 'excel', icon: 'grid' },
  { label: 'Image', value: 'image', icon: 'image' },
];

export default function AdminProgrammeUploadScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { countryCode } = useUserCountry();
  const niveauxLabels = useMemo(
    () => getSystemeEducatif(countryCode || 'CM').niveaux.map((n) => n.nom),
    [countryCode]
  );
  const matieresLabels = useMemo(() => {
    const rows = getSystemeEducatif(countryCode || 'CM').matieres;
    return [...new Set(rows.map((r) => r.matiere))].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [countryCode]);

  const [niveau, setNiveau] = useState('');
  const [classe, setClasse] = useState('');
  const [matiereHint, setMatiereHint] = useState('');
  const [periodeAcademique, setPeriodeAcademique] = useState('2025-2026');
  const [dateDebut, setDateDebut] = useState('2025-09-01');
  const [dateFin, setDateFin] = useState('2026-07-31');
  const [fichierType, setFichierType] = useState<'pdf' | 'excel' | 'image'>('pdf');
  const [fichierNom, setFichierNom] = useState('');
  const [fichierBase64, setFichierBase64] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    programme_id: number;
    extraction: ProgrammeExtractionResult | null;
    message: string;
    detection?: {
      etablissement?: string;
      ville?: string;
      session?: string;
      classe?: string;
      session_coherente?: boolean | null;
      classe_coherente?: boolean | null;
    };
    accessoires?: Array<{ nom: string; quantite?: number; gamme?: string }>;
  } | null>(null);

  const applyImageAssetBase64 = useCallback(async (asset: ImagePicker.ImagePickerAsset, fallbackName: string) => {
    let base64 = asset.base64;
    if (!base64) {
      base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    setFichierNom(asset.fileName || fallbackName);
    setFichierBase64(base64);
  }, []);

  const takePhotoProgramme = useCallback(async () => {
    if (fichierType !== 'image') return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', t('bourseLivreV2.programmeUpload.cameraPermission', "Autorisez l'accès à la caméra pour photographier le programme."));
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        await applyImageAssetBase64(result.assets[0], `programme_${Date.now()}.jpg`);
      }
    } catch {
      Alert.alert('Erreur', t('bourseLivreV2.programmeUpload.errorRead'));
    }
  }, [fichierType, applyImageAssetBase64, t]);

  const pickImageGalleryProgramme = useCallback(async () => {
    if (fichierType !== 'image') return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', t('bourseLivreV2.programmeUpload.galleryPermission', "Autorisez l'accès à la galerie."));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        await applyImageAssetBase64(result.assets[0], `programme_${Date.now()}.jpg`);
      }
    } catch {
      Alert.alert('Erreur', t('bourseLivreV2.programmeUpload.errorRead'));
    }
  }, [fichierType, applyImageAssetBase64, t]);

  const pickFile = useCallback(async () => {
    try {
      const mimeTypes =
        fichierType === 'pdf'
          ? ['application/pdf']
          : fichierType === 'excel'
            ? ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
            : ['image/jpeg', 'image/png', 'image/webp'];

      const docResult = await DocumentPicker.getDocumentAsync({
        type: mimeTypes,
        copyToCacheDirectory: true,
      });

      if (docResult.canceled || !docResult.assets?.[0]) return;

      const asset = docResult.assets[0];
      setFichierNom(asset.name);

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setFichierBase64(base64);
    } catch (err) {
      Alert.alert('Erreur', t('bourseLivreV2.programmeUpload.errorRead'));
    }
  }, [fichierType]);

  const handleUpload = useCallback(async () => {
    if (!niveau) {
      Alert.alert('Erreur', t('bourseLivreV2.programmeUpload.errorNiveau'));
      return;
    }
    if (!periodeAcademique) {
      Alert.alert('Erreur', t('bourseLivreV2.programmeUpload.errorPeriode'));
      return;
    }
    if (!fichierBase64) {
      Alert.alert('Erreur', t('bourseLivreV2.programmeUpload.errorFile'));
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await bourseLivreV2Api.uploadProgrammeFile({
        niveau,
        periode_academique: periodeAcademique,
        fichier_base64: fichierBase64,
        fichier_nom: fichierNom,
        fichier_type: fichierType,
        classe: classe || undefined,
        date_debut_validite: dateDebut || undefined,
        date_fin_validite: dateFin || undefined,
      });
      setResult(res);
      Alert.alert(t('bourseLivreV2.programmeUpload.success'), res.message);
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || t('bourseLivreV2.programmeUpload.errorUpload'));
    } finally {
      setLoading(false);
    }
  }, [niveau, classe, periodeAcademique, dateDebut, dateFin, fichierType, fichierNom, fichierBase64]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('bourseLivreV2.programmeUpload.title')}</Text>
      <Text style={styles.subtitle}>
        {t('bourseLivreV2.programmeUpload.subtitle')}
      </Text>

      {/* Niveau */}
      <Text style={styles.label}>{t('bourseLivreV2.programmeUpload.niveau')} *</Text>
      <View style={styles.chipRow}>
        {NIVEAUX.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, niveau === n && styles.chipActive]}
            onPress={() => setNiveau(n)}
          >
            <Text style={[styles.chipText, niveau === n && styles.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Classe — saisie + suggestions (référentiel pays) pour aligner les imports sur les filtres utilisateurs */}
      <Text style={styles.label}>{t('bourseLivreV2.programmeUpload.classe')}</Text>
      <TextInput
        style={styles.input}
        value={classe}
        onChangeText={setClasse}
        placeholder={t('bourseLivreV2.programmeUpload.classePlaceholder')}
        placeholderTextColor="#999"
      />
      <Text style={styles.hintSmall}>
        {t(
          'bourseLivreV2.programmeUpload.classeHint',
          'Choisissez une étiquette proche du programme officiel (ex. 6ème, CM2) pour faciliter l’autocomplete côté familles.'
        )}
      </Text>
      <View style={styles.suggestRow}>
        {niveauxLabels
          .filter((n) => !classe.trim() || n.toLowerCase().includes(classe.trim().toLowerCase()))
          .slice(0, 14)
          .map((n) => (
            <TouchableOpacity key={n} style={styles.suggestChip} onPress={() => setClasse(n)} activeOpacity={0.7}>
              <Text style={styles.suggestChipText} numberOfLines={1}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      <Text style={styles.label}>{t('bourseLivreV2.programmeUpload.matiereHintLabel', 'Matière (indicatif, optionnel)')}</Text>
      <TextInput
        style={styles.input}
        value={matiereHint}
        onChangeText={setMatiereHint}
        placeholder={t('bourseLivreV2.programmeUpload.matierePlaceholder', 'Filtre pour suggestions…')}
        placeholderTextColor="#999"
      />
      <View style={styles.suggestRow}>
        {matieresLabels
          .filter((m) => !matiereHint.trim() || m.toLowerCase().includes(matiereHint.trim().toLowerCase()))
          .slice(0, 12)
          .map((m) => (
            <TouchableOpacity key={m} style={styles.suggestChipAlt} onPress={() => setMatiereHint(m)} activeOpacity={0.7}>
              <Text style={styles.suggestChipText} numberOfLines={1}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      {/* Période académique */}
      <Text style={styles.label}>{t('bourseLivreV2.programmeUpload.periodeAcademique')} *</Text>
      <TextInput
        style={styles.input}
        value={periodeAcademique}
        onChangeText={setPeriodeAcademique}
        placeholder="2025-2026"
        placeholderTextColor="#999"
      />

      {/* Dates de validité */}
      <View style={styles.row}>
        <View style={styles.halfCol}>
          <Text style={styles.label}>{t('bourseLivreV2.programmeUpload.dateDebut')}</Text>
          <TextInput
            style={styles.input}
            value={dateDebut}
            onChangeText={setDateDebut}
            placeholder="2025-09-01"
            placeholderTextColor="#999"
          />
        </View>
        <View style={styles.halfCol}>
          <Text style={styles.label}>{t('bourseLivreV2.programmeUpload.dateFin')}</Text>
          <TextInput
            style={styles.input}
            value={dateFin}
            onChangeText={setDateFin}
            placeholder="2026-07-31"
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {/* Type de fichier */}
      <Text style={styles.label}>{t('bourseLivreV2.programmeUpload.fichierType')}</Text>
      <View style={styles.chipRow}>
        {FICHIER_TYPES.map((ft) => (
          <TouchableOpacity
            key={ft.value}
            style={[styles.chip, fichierType === ft.value && styles.chipActive]}
            onPress={() => setFichierType(ft.value as any)}
          >
            <Ionicons
              name={ft.icon as any}
              size={16}
              color={fichierType === ft.value ? '#fff' : '#666'}
            />
            <Text style={[styles.chipText, fichierType === ft.value && styles.chipTextActive, { marginLeft: 4 }]}>
              {ft.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {fichierType === 'image' ? (
        <View style={styles.imageSourceRow}>
          <TouchableOpacity style={styles.imageSourceBtn} onPress={takePhotoProgramme}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.imageSourceBtnText}>
              {t('bourseLivreV2.programmeUpload.camera', 'Caméra')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.imageSourceBtn, styles.imageSourceBtnAlt]} onPress={pickImageGalleryProgramme}>
            <Ionicons name="images" size={20} color="#fff" />
            <Text style={styles.imageSourceBtnText}>
              {t('bourseLivreV2.programmeUpload.gallery', 'Galerie')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Sélection fichier (import) */}
      <Text style={styles.label}>
        {fichierType === 'image'
          ? t('bourseLivreV2.programmeUpload.orImportFile', 'Ou importer un fichier image')
          : t('bourseLivreV2.programmeUpload.importFile', 'Importer un fichier')}
      </Text>
      <TouchableOpacity style={styles.filePickerBtn} onPress={pickFile}>
        <Ionicons name="cloud-upload-outline" size={24} color="#4A90D9" />
        <Text style={styles.filePickerText}>
          {fichierNom || t('bourseLivreV2.programmeUpload.selectFile')}
        </Text>
      </TouchableOpacity>
      {fichierBase64 ? (
        <Text style={styles.fileReady}>
          {t('bourseLivreV2.programmeUpload.fileReady', { size: (fichierBase64.length * 0.75 / 1024).toFixed(0) })}
        </Text>
      ) : null}

      {/* Bouton upload */}
      <TouchableOpacity
        style={[styles.uploadBtn, loading && styles.uploadBtnDisabled]}
        onPress={handleUpload}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.uploadBtnText}>{t('bourseLivreV2.programmeUpload.uploadBtn')}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Résultat */}
      {/* Bannière de validation IA — établissement, ville, session, classe */}
      {result?.detection && (
        <View style={styles.detectionBanner}>
          <Text style={styles.detectionTitle}>Détection IA</Text>
          <View style={styles.detectionGrid}>
            {result.detection.etablissement ? (
              <View style={styles.detectionCell}>
                <Text style={styles.detectionLabel}>École</Text>
                <Text style={styles.detectionValue} numberOfLines={1}>{result.detection.etablissement}</Text>
              </View>
            ) : null}
            {result.detection.ville ? (
              <View style={styles.detectionCell}>
                <Text style={styles.detectionLabel}>Ville</Text>
                <Text style={styles.detectionValue}>{result.detection.ville}</Text>
              </View>
            ) : null}
            {result.detection.session ? (
              <View style={[styles.detectionCell, result.detection.session_coherente === false && styles.detectionCellError]}>
                <Text style={styles.detectionLabel}>Session</Text>
                <Text style={[styles.detectionValue, result.detection.session_coherente === false && styles.detectionValueError]}>
                  {result.detection.session}
                  {result.detection.session_coherente === false ? ' ⚠️' : ''}
                </Text>
              </View>
            ) : null}
            {result.detection.classe ? (
              <View style={[styles.detectionCell, result.detection.classe_coherente === false && styles.detectionCellError]}>
                <Text style={styles.detectionLabel}>Classe</Text>
                <Text style={[styles.detectionValue, result.detection.classe_coherente === false && styles.detectionValueError]}>
                  {result.detection.classe}
                  {result.detection.classe_coherente === false ? ' ⚠️' : ''}
                </Text>
              </View>
            ) : null}
          </View>
          {(result.detection.session_coherente === false || result.detection.classe_coherente === false) && (
            <Text style={styles.detectionWarning}>
              ⚠️ La session ou la classe détectée ne correspond pas à vos paramètres — vérifiez le document.
            </Text>
          )}
        </View>
      )}

      {/* Accessoires détectés */}
      {result?.accessoires && result.accessoires.length > 0 && (
        <View style={styles.accessoiresCard}>
          <Text style={styles.resultTitle}>Accessoires détectés ({result.accessoires.length})</Text>
          {result.accessoires.map((a, i) => (
            <View key={i} style={styles.recapRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recapRowTitle}>{a.nom}</Text>
                <Text style={styles.recapRowMeta}>
                  {[a.quantite ? `×${a.quantite}` : null, a.gamme].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {result?.extraction && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            {t('bourseLivreV2.programmeUpload.booksExtracted', { count: result.extraction.nombre_total })}
          </Text>
          <Text style={styles.resultSubtitle}>
            {t('bourseLivreV2.programmeUpload.confidence', { percent: (result.extraction.confidence * 100).toFixed(0) })}
          </Text>
          {result.extraction.classes_couvertes.length > 0 && (
            <Text style={styles.resultDetail}>
              {t('bourseLivreV2.programmeUpload.classes', { list: result.extraction.classes_couvertes.join(', ') })}
            </Text>
          )}
          {result.extraction.matieres_couvertes.length > 0 && (
            <Text style={styles.resultDetail}>
              {t('bourseLivreV2.programmeUpload.matieres', { list: result.extraction.matieres_couvertes.join(', ') })}
            </Text>
          )}

          <View style={styles.separator} />

          {result.extraction.livres.slice(0, 10).map((livre, idx) => (
            <View key={idx} style={styles.livreRow}>
              <View style={styles.livreInfo}>
                <Text style={styles.livreTitre} numberOfLines={1}>{livre.titre}</Text>
                <Text style={styles.livreDetail}>
                  {livre.matiere} · {livre.classe}
                  {livre.prix_officiel ? ` · ${livre.prix_officiel} XAF` : ''}
                </Text>
              </View>
              <Ionicons
                name={livre.est_obligatoire ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={livre.est_obligatoire ? '#4CAF50' : '#999'}
              />
            </View>
          ))}
          {result.extraction.livres.length > 10 && (
            <Text style={styles.moreText}>
              {t('bourseLivreV2.programmeUpload.moreBooks', { count: result.extraction.livres.length - 10 })}
            </Text>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  hintSmall: { fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 17 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E8F4FD',
    borderWidth: 1,
    borderColor: '#B6DDFF',
  },
  suggestChipAlt: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8C4F7',
  },
  suggestChipText: { fontSize: 12, color: '#333', fontWeight: '500' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: '#333',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  halfCol: { flex: 1 },
  imageSourceRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 4,
  },
  imageSourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    marginHorizontal: 4,
  },
  imageSourceBtnAlt: { backgroundColor: '#7C3AED' },
  imageSourceBtnText: { color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 6 },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4A90D9',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  filePickerText: { fontSize: 15, color: '#4A90D9', fontWeight: '500' },
  fileReady: { fontSize: 12, color: '#4CAF50', textAlign: 'center', marginTop: 6 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  resultTitle: { fontSize: 18, fontWeight: '700', color: '#2E7D32' },
  resultSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  resultDetail: { fontSize: 13, color: '#444', marginTop: 4 },
  separator: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 12 },
  livreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  livreInfo: { flex: 1 },
  livreTitre: { fontSize: 14, fontWeight: '600', color: '#333' },
  livreDetail: { fontSize: 12, color: '#888', marginTop: 2 },
  moreText: { fontSize: 13, color: '#4A90D9', textAlign: 'center', marginTop: 8 },
  // Detection banner
  detectionBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  detectionTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  detectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detectionCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  detectionCellError: { borderColor: '#FCA5A5', backgroundColor: '#FFF1F1' },
  detectionLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  detectionValue: { fontSize: 13, fontWeight: '700', color: '#374151' },
  detectionValueError: { color: '#DC2626' },
  detectionWarning: { fontSize: 12, color: '#B45309', marginTop: 10, lineHeight: 17 },
  // Accessoires card
  accessoiresCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  recapRowTitle: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  recapRowMeta: { fontSize: 11, color: '#6B7280', marginTop: 1 },
});
