import React, { useState, useEffect } from 'react';
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
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📅 Réservation en temps réel</h2>
      <input
        className="border p-2 mb-2 w-full"
        placeholder="ID utilisateur"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />
      <input
        className="border p-2 mb-2 w-full"
        placeholder="ID service"
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
      />
      <input
        className="border p-2 mb-2 w-full"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <input
        className="border p-2 mb-2 w-full"
        placeholder="Créneau horaire (ex: 14h-15h)"
        value={slot}
        onChange={(e) => setSlot(e.target.value)}
      />
      <button className="bg-blue-600 text-white p-2 rounded" onClick={handleReservation}>
        Réserver
      </button>

      {result && (
        <div className="mt-4 text-green-700">
          <p className="font-semibold">{result.status}</p>
          <p>Affecté au prestataire ID : {result.assigned_to}</p>
        </div>
      )}
    </div>
  );
};

export default ReservationPanel;