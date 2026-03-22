// @ts-nocheck
// Version minimaliste - aucun hook potentiellement problématique
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';

interface Service {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  views: number;
  interactions: number;
  user_id: string;
  data?: any;
}

const MesServicesScreenMinimal: React.FC = () => {
  console.log('[MesServicesScreenMinimal] 🚀 Démarrage MINIMAL');
  
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // États minimales - aucun hook complexe
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fonction de chargement simplifiée
  const loadServices = useCallback(async (isRefresh = false) => {
    console.log('[MesServicesScreenMinimal] 🔍 Début chargement MINIMAL');
    
    if (!user) {
      console.warn('[MesServicesScreenMinimal] ⚠️ Utilisateur non connecté');
      setError('Utilisateur non connecté');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      if (isRefresh) {
        console.log('[MesServicesScreenMinimal] 🔄 Refresh demandé');
      }

      console.log('[MesServicesScreenMinimal] 📡 Appel API /api/prestataire/services');
      const response = await apiGet('/api/prestataire/services');

      console.log('[MesServicesScreenMinimal] 📦 Réponse API:', {
        ok: response?.ok,
        status: response?.status,
        success: response?.success,
        hasData: !!response?.data
      });

      if (response?.success && response?.data) {
        let data = response.data;
        
        // Gérer différents formats de réponse
        if (!Array.isArray(data)) {
          if (Array.isArray(data?.data)) {
            data = data.data;
          } else if (Array.isArray(data?.services)) {
            data = data.services;
          } else if (Array.isArray(data?.items)) {
            data = data.items;
          }
        }

        if (Array.isArray(data)) {
          console.log('[MesServicesScreenMinimal] ✅ Services trouvés:', data.length);
          setServices(data);
        } else {
          console.warn('[MesServicesScreenMinimal] ⚠️ Format de réponse non attendu:', typeof data);
          setServices([]);
        }
      } else {
        console.error('[MesServicesScreenMinimal] ❌ Erreur API:', response);
        setError('Erreur lors du chargement des services');
        setServices([]);
      }
    } catch (err) {
      console.error('[MesServicesScreenMinimal] 💥 Exception:', err);
      setError('Exception lors du chargement');
      setServices([]);
    } finally {
      setLoading(false);
      console.log('[MesServicesScreenMinimal] ✅ Chargement terminé');
    }
  }, [user]);

  // Effet de montage - SANS dépendances cycliques
  useEffect(() => {
    console.log('[MesServicesScreenMinimal] 🚀 Montage du composant MINIMAL');
    loadServices().catch(err => {
      console.error('[MesServicesScreenMinimal] Erreur loadServices au montage:', err);
    });
    
    return () => {
      console.log('[MesServicesScreenMinimal] 🔄 Nettoyage du composant MINIMAL');
    };
  }, []); // ✅ ZÉRO dépendances

  // Effet de focus - SANS dépendances cycliques
  useFocusEffect(
    useCallback(() => {
      console.log('[MesServicesScreenMinimal] 🎯 Focus sur l écran MINIMAL');
      loadServices(true);
    }, []) // ✅ ZÉRO dépendances
  );

  // Rendu simplifié
  console.log('[MesServicesScreenMinimal] 🎨 Rendu MINIMAL - Loading:', loading, 'Services:', services.length, 'Error:', !!error);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Erreur: {error}</Text>
        <Text style={styles.retryText} onPress={() => loadServices(true)}>Réessayer</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mes Services ({services.length})</Text>
      
      {services.length === 0 ? (
        <View style={styles.center}>
          <Text>Aucun service trouvé</Text>
        </View>
      ) : (
        services.map((service, index) => (
          <View key={service.id || index} style={styles.serviceCard}>
            <Text style={styles.serviceTitle}>{service.title || 'Sans titre'}</Text>
            <Text style={styles.serviceDescription}>{service.description || 'Sans description'}</Text>
            <Text style={styles.serviceStatus}>Status: {service.status}</Text>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 8,
  },
  retryText: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
  serviceCard: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  serviceStatus: {
    fontSize: 12,
    color: '#999',
  },
});

export default MesServicesScreenMinimal;
