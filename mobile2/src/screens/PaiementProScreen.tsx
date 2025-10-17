// @ts-check
import * as React from "react";
import { useState } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from 'react-router-dom';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

const PaiementProPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigation();

  const handlePaiement = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        navigation.navigate('Dashboard');
      }, 2500);
    }, 2000);
  };

  return (
    <RequireAccess plan="pro">
      <ResponsiveContainer>
        <View style="pt-24">
          <Text style="text-2xl font-bold mb-4">💳 Paiement - Plan Pro</Text>

          {loading ? (
            <Text style="text-blue-600 font-medium">Chargement en cours...</Text>
          ) : success ? (
            <Text style="text-green-600 font-semibold">
              ✅ Paiement effectué avec succès ! Redirection...
            </Text>
          ) : (
            <TouchableOpacity
              onPress={handlePaiement}
              style="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Payer maintenant
            </TouchableOpacity>
          )}
        </View>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default PaiementProPage;





