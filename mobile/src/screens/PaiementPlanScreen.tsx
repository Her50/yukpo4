// @ts-nocheck
// @ts-check
import * as React from "react";
import { StyleSheet, Text, View } from 'react-native';

const PaiementPlanPage: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>💳 Plan de paiement</Text>
    <Text style={styles.message}>Cette page est en cours de construction.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1F2937',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
  },
});

export default PaiementPlanPage;






