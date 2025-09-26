import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const ReservationPanel: React.FC = () => {
  const [userId, setUserId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [result, setResult] = useState<{ status: string; assigned_to: number } | null>(null);

  const handleReservation = async () => {
    try {
      const res = await axios.post("/api/reserve", {
        user_id: Number(userId),
        service_id: Number(serviceId),
        date,
        timeslot: slot,
      });
      setResult(res.data);
    } catch (error) {
      console.error("Erreur lors de la réservation :", error);
      setResult(null);
    }
  };

  return (
    <View style="p-6">
      <Text style="text-2xl font-bold mb-4">📅 Réservation en temps réel</Text>
      <TextInput
        style="border p-2 mb-2 w-full"
        placeholder="ID utilisateur"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />
      <TextInput
        style="border p-2 mb-2 w-full"
        placeholder="ID service"
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
      />
      <TextInput
        style="border p-2 mb-2 w-full"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <TextInput
        style="border p-2 mb-2 w-full"
        placeholder="Créneau horaire (ex: 14h-15h)"
        value={slot}
        onChange={(e) => setSlot(e.target.value)}
      />
      <TouchableOpacity style="bg-blue-600 text-white p-2 rounded" onPress={handleReservation}>
        Réserver
      </TouchableOpacity>

      {result && (
        <View style="mt-4 text-green-700">
          <Text style="font-semibold">{result.status}</Text>
          <Text>Affecté au prestataire ID : {result.assigned_to}</Text>
        </View>
      )}
    </View>
  );
};

export default ReservationPanel;




