// @ts-nocheck
import * as React from "react";
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useUserContext } from '../context/UserContext';
import { gpsTrackingService } from '../services/gpsTrackingService';
import { API_BASE_URL } from '../config/api';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface GPSAutoTrackerProps {
  autoStart?: boolean;
  showStatus?: boolean;
}

const GPSAutoTracker: React.FC<GPSAutoTrackerProps> = ({
  autoStart = true,
  showStatus = true
}) => {
  const { user } = useUserContext();
      const { t } = useLanguageSafe();
const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (autoStart && user) {
      // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
      startGPSTracking().catch(error => {
        console.error('[GPSAutoTracker] Erreur startGPSTracking:', error);
      });
    }

    return () => {
      if (isTracking) {
        gpsTrackingService.stopTracking();
      }
    };
  }, [user, autoStart]);

  const startGPSTracking = async () => {
    try {
      console.log('\uD83D\uDE80 Démarrage du tracking GPS automatique...');

      // Démarrer le service de tracking
      gpsTrackingService.startTracking();
      setIsTracking(true);

      // Obtenir la position actuelle
      await getCurrentLocation();

      // Écouter les mises à jour de position
      const interval = setInterval(async () => {
        try {
          const newLocation = await gpsTrackingService.getCurrentLocation();
          if (newLocation) {
            const coords = `${newLocation.latitude.toFixed(6)},${newLocation.longitude.toFixed(6)}`;
            setCurrentLocation(coords);
            setLastUpdate(new Date());

            console.log(`\uD83D\uDCCD Position GPS mise à jour: ${coords}`);

            // Envoyer au backend
            await updateBackendGPS(newLocation.latitude, newLocation.longitude);
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors de la mise à jour GPS:', error);
        }
      }, 5 * 60 * 1000); // Mise à jour toutes les 5 minutes

      return () => clearInterval(interval);
    } catch (error) {
      console.error('❌ Erreur lors du démarrage du tracking GPS:', error);
      setIsTracking(false);
    }
  };

  const stopGPSTracking = () => {
    gpsTrackingService.stopTracking();
    setIsTracking(false);
    console.log('\uD83D\uDED1 Tracking GPS arrêté');
  };

  const getCurrentLocation = async () => {
    try {
      const location = await gpsTrackingService.getCurrentLocation();
      if (location) {
        const coords = `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
        setCurrentLocation(coords);
        setLastUpdate(new Date());

        console.log(`\uD83D\uDCCD Position GPS actuelle: ${coords}`);

        // Envoyer au backend
        await updateBackendGPS(location.latitude, location.longitude);

        return coords;
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de la position:', error);
    }
    return null;
  };

  const updateBackendGPS = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/me/gps_location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy: 10, // Précision par défaut
        }),
      });

      if (response.ok) {
        console.log('✅ Position GPS mise à jour dans le backend');
      } else {
        console.warn('⚠️ Erreur lors de la mise à jour GPS dans le backend');
      }
    } catch (error) {
      console.error('❌ Erreur réseau lors de la mise à jour GPS:', error);
    }
  };

  const getLocationString = () => {
    if (!currentLocation) return '';
    return currentLocation;
  };

  if (!showStatus) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          \uD83D\uDCCD Tracking GPS
        </Text>
        <View style={[styles.statusDot, isTracking ? styles.statusDotActive : styles.statusDotInactive]} />
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.label}>Statut:</Text>
          <Text style={[styles.value, isTracking ? styles.valueActive : styles.valueInactive]}>
            {isTracking ? 'Actif' : 'Inactif'}
          </Text>
        </View>

        {currentLocation && (
          <View style={styles.row}>
            <Text style={styles.label}>Position:</Text>
            <Text style={styles.locationValue}>
              {currentLocation}
            </Text>
          </View>
        )}

        {lastUpdate && (
          <View style={styles.row}>
            <Text style={styles.label}>{t('gPSAutoTracker.derniereMiseAJour')}</Text>
            <Text style={styles.value}>
              {lastUpdate.toLocaleTimeString()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {!isTracking ? (
          <TouchableOpacity
            onPress={startGPSTracking}
            style={[styles.button, styles.buttonStart]}
          >
            <Text style={styles.buttonText}>{t('gPSAutoTracker.demarrer')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={stopGPSTracking}
            style={[styles.button, styles.buttonStop]}
          >
            <Text style={styles.buttonText}>{t('gPSAutoTracker.arreter')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={getCurrentLocation}
          style={[styles.button, styles.buttonRefresh]}
        >
          <Text style={styles.buttonText}>{t('gPSAutoTracker.actualiser')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotInactive: {
    backgroundColor: '#EF4444',
  },
  content: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  value: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '500',
  },
  valueActive: {
    color: '#059669',
  },
  valueInactive: {
    color: '#DC2626',
  },
  locationValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#111827',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonStart: {
    backgroundColor: '#059669',
  },
  buttonStop: {
    backgroundColor: '#DC2626',
  },
  buttonRefresh: {
    backgroundColor: '#2563EB',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default GPSAutoTracker;




