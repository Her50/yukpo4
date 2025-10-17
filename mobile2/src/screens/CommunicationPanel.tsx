import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';


export default function CommunicationPanel() {
  const [status, setStatus] = useState('');

  const sendAction = async (type: string) => {
    setStatus('⏳ Envoi en cours...');
    try {
      const res = await fetch(`/send/${type}`);
      const json = await res.json();
      setStatus(json.status || json.error || '✅ Action terminée');
    } catch (err) {
      setStatus('❌ Erreur réseau');
    }
  };

  const generatePdf = async () => {
    setStatus('⏳ Génération PDF...');
    try {
      const res = await fetch('/admin/generate-pdf');
      const json = await res.json();
      setStatus(json.status || json.error || '✅ PDF généré');
    } catch (err) {
      setStatus('❌ Erreur lors du PDF');
    }
  };

  return (
    <View style="">
      <Text style="text-3xl font-bold text-center mb-10">
        📨 Centre Yukpomnang : Export & Partage
      </Text>

      <View style="">
        <TouchableOpacity
          onPress={generatePdf}
          style=""
        >
          📄 Générer un PDF Yukpomnang
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => sendAction('email')}
          style=""
        >
          ✉️ Envoyer par Email
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => sendAction('whatsapp')}
          style=""
        >
          📲 Partager via WhatsApp
        </TouchableOpacity>
      </View>

      {status && (
        <View style="mt-10 text-center font-semibold text-orange-700">
          {status}
        </View>
      )}

      <footer style="text-center text-sm text-gray-500 mt-20 border-t pt-6">
        Yukpomnang Connect — Communication multicanal © 2025
      </footer>
    </View>
  );
}




