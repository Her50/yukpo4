// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NavigatorToolbar from '../components/NavigatorToolbar';

const NotFound: React.FC = () => {
  const navigation = useNavigation();

  const handleClose = React.useCallback(() => {
    if ((navigation as any).canGoBack && (navigation as any).canGoBack()) {
      (navigation as any).goBack();
      return;
    }
    (navigation as any).navigate('Home');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <NavigatorToolbar
        title="Page introuvable"
        subtitle="Erreur 404"
        showHandle={false}
        density="compact"
        backIcon="back"
        onClose={handleClose}
      />

      <View style={styles.content}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.message}>Cette page n'existe plus ou est momentanément indisponible.</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => (navigation as any).navigate('Home')}
        >
          <Text style={styles.buttonText}>Revenir à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  message: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotFound;






