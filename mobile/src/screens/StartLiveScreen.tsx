import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeIcon from '../components/SafeIcon';
import { NativeButton, NativeInput } from '../components/SafeNativeDesign';
import { useAuth } from '../contexts/AuthContext';
import { liveStreamingService, StartLiveSessionPayload } from '../services/liveStreamingService';

type RouteParams = {
  serviceId?: number;
};

export default function StartLiveScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    (route.params as any)?.serviceId || null
  );
  const [userServices, setUserServices] = useState<Array<{ id: number; title: string }>>([]);

  // Load user's services for selection
  useEffect(() => {
    if (user?.id) {
      // TODO: Fetch user's services from API
      // For now, using mock data
      setUserServices([
        { id: 1, title: 'Restaurant Le Gourmet' },
        { id: 2, title: 'Boutique Mode Élégante' },
        { id: 3, title: 'Service de Nettoyage Pro' },
      ]);
    }
  }, [user]);

  const handleStartLive = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour démarrer un live');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un titre pour votre live');
      return;
    }

    setIsStarting(true);

    try {
      const payload: StartLiveSessionPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        host_user_id: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
        service_id: selectedServiceId || undefined,
        scheduled_start: new Date().toISOString(),
        metadata: {
          source: 'mobile',
          platform: 'react_native',
        },
      };

      const response = await liveStreamingService.startLiveSession(payload);

      if (response.success && response.data) {
        const sessionData = response.data as any;
        Alert.alert(
          'Live démarré!',
          'Votre session live est maintenant active. Vous pouvez commencer à diffuser.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to live host view or streaming interface
                navigation.navigate('LiveHostScreen' as any, {
                  sessionId: sessionData.id,
                  streamKey: sessionData.stream_key,
                  rtmpUrl: sessionData.fallback_rtmp_url,
                });
              },
            },
          ]
        );
      } else {
        throw new Error(response.error || 'Échec du démarrage du live');
      }
    } catch (error: any) {
      console.error('[StartLiveScreen] Erreur démarrage live:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible de démarrer le live. Veuillez réessayer.'
      );
    } finally {
      setIsStarting(false);
    }
  }, [user, title, description, selectedServiceId, navigation]);

  const renderServiceSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Service associé (optionnel)</Text>
      <Text style={styles.sectionDescription}>
        Liez ce live à l'un de vos services pour permettre les ventes flash
      </Text>

      {userServices.map((service) => (
        <TouchableOpacity
          key={service.id}
          style={[
            styles.serviceOption,
            selectedServiceId === service.id && styles.serviceOptionSelected,
          ]}
          onPress={() => setSelectedServiceId(service.id)}
        >
          <SafeIcon
            name={selectedServiceId === service.id ? 'check-circle' : 'circle'}
            size={20}
            color={selectedServiceId === service.id ? '#DC2626' : '#9CA3AF'}
          />
          <Text style={[
            styles.serviceOptionText,
            selectedServiceId === service.id && styles.serviceOptionTextSelected,
          ]}>
            {service.title}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[
          styles.serviceOption,
          selectedServiceId === null && styles.serviceOptionSelected,
        ]}
        onPress={() => setSelectedServiceId(null)}
      >
        <SafeIcon
          name={selectedServiceId === null ? 'check-circle' : 'circle'}
          size={20}
          color={selectedServiceId === null ? '#DC2626' : '#9CA3AF'}
        />
        <Text style={[
          styles.serviceOptionText,
          selectedServiceId === null && styles.serviceOptionTextSelected,
        ]}>
          Aucun (live général)
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Démarrer un Live</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations du Live</Text>
          <Text style={styles.sectionDescription}>
            Donnez un titre attractif pour votre audience
          </Text>

          <NativeInput
            placeholder="Titre du live..."
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            maxLength={100}
          />

          <NativeInput
            placeholder="Description (optionnel)..."
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </View>

        {userServices.length > 0 && renderServiceSelector()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conseils pour un live réussi</Text>
          <View style={styles.tipsContainer}>
            <View style={styles.tip}>
              <SafeIcon name="wifi" size={16} color="#6366F1" />
              <Text style={styles.tipText}>Assurez-vous d'avoir une connexion internet stable</Text>
            </View>
            <View style={styles.tip}>
              <SafeIcon name="video" size={16} color="#6366F1" />
              <Text style={styles.tipText}>Utilisez un bon éclairage et une caméra stable</Text>
            </View>
            <View style={styles.tip}>
              <SafeIcon name="users" size={16} color="#6366F1" />
              <Text style={styles.tipText}>Interagissez avec votre audience via le chat</Text>
            </View>
            <View style={styles.tip}>
              <SafeIcon name="zap" size={16} color="#6366F1" />
              <Text style={styles.tipText}>Préparez des offres spéciales ou ventes flash</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <NativeButton
            title={isStarting ? 'Démarrage en cours...' : 'Démarrer le Live'}
            onPress={handleStartLive}
            disabled={isStarting || !title.trim()}
            style={[
              styles.startButton,
              (isStarting || !title.trim()) && styles.startButtonDisabled,
            ]}
          >
            {isStarting && (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
                style={styles.buttonLoader}
              />
            )}
          </NativeButton>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceOptionSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  serviceOptionText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  serviceOptionTextSelected: {
    color: '#DC2626',
    fontWeight: '500',
  },
  tipsContainer: {
    gap: 12,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  actions: {
    paddingTop: 16,
    gap: 12,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  buttonLoader: {
    marginRight: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
});
