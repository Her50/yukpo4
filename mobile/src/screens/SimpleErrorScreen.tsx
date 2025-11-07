// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NavigatorToolbar from '../components/NavigatorToolbar';

interface SimpleErrorScreenProps {
  message?: string;
  onRetry?: () => void;
}

const SimpleErrorScreen: React.FC<SimpleErrorScreenProps> = ({
  message = "Cette fonctionnalité n'est pas encore disponible",
  onRetry
}) => {
  const navigation = useNavigation();

  const handleGoHome = () => {
    (navigation as any).navigate('Home');
  };

  const handleGoBack = () => {
    (navigation as any).goBack();
  };

  return (
    <View style={styles.container}>
      <NavigatorToolbar
        title="Fonctionnalité indisponible"
        subtitle={message}
        showHandle={false}
        onClose={handleGoBack}
      />
      <View style={styles.errorCard}>
        <Ionicons name="construct" size={64} color="#FFD700" style={styles.errorIcon} />

        <Text style={styles.errorTitle}>En cours de développement</Text>
        <Text style={styles.errorMessage}>{message}</Text>

        <View style={styles.buttonContainer}>
          {onRetry ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={onRetry}>
              <Ionicons name="refresh" size={20} color="#FFD700" />
              <Text style={styles.secondaryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Ionicons name="home" size={20} color="white" />
            <Text style={styles.homeButtonText}>Accueil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 320,
    width: '100%',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  homeButton: {
    flex: 1,
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  homeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SimpleErrorScreen;

