import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useCallback, useState } from 'react';
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
import { bourseLivreV2Api, ProgrammeExtractionResult } from '../../services/bourseLivreV2Api';
import { useLanguageSafe } from '../contexts/LanguageContext';

const NIVEAUX = ['Maternelle', 'Primaire', t('adminProgrammeUploadScreen.college'), t('adminProgrammeUploadScreen.lycee'), t('adminProgrammeUploadScreen.universite')];
const FICHIER_TYPES = [
  { label: 'PDF', value: 'pdf', icon: 'document-text' },
  { label: 'Excel', value: 'excel', icon: 'grid' },
  { label: 'Image', value: 'image', icon: 'image' },
];

export default function AdminProgrammeUploadScreen({ navigation }: any) {
  const { t } = useTranslation();
      const { t } = useLanguageSafe();
const [niveau, setNiveau] = useState('');
  const [classe, setClasse] = useState('');
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
  } | null>(null);

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

      {/* Classe */}
      <Text style={styles.label}>{t('bourseLivreV2.programmeUpload.classe')}</Text>
      <TextInput
        style={styles.input}
        value={classe}
        onChangeText={setClasse}
        placeholder={t('bourseLivreV2.programmeUpload.classePlaceholdert('adminProgrammeUploadScreen.placeholdertextcolor999PeriodeAcademiqueTextStyles')bourseLivreV2.programmeUpload.periodeAcademique')} *</Text>
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

      {/* Sélection fichier */}
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
});
