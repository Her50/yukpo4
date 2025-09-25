// @ts-check
import React, { useState } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';
import styled, { keyframes } from 'styled-components';

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.75; }
  100% { transform: scale(1); opacity: 1; }
`;

const PulseBox = styled.div`
  animation: ${pulseAnimation} 2s infinite;
  margin-top: 3rem;
  padding: 1.5rem;
  background-color: #f3f4f6;
  border-radius: 12px;
  text-align: center;
`;

const TicketPage: React.FC = () => {
  const [depart, setDepart] = useState("");
  const [arrivee, setArrivee] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [type, setType] = useState("bus");
  const [iaResponse, setIaResponse] = useState("Suggestion d’itinéraire automatique disponible.");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { depart, arrivee, date, heure, type };
    console.log("🚌 Données soumises :", data);
    alert("🤖 Connexion backend en attente...");
  };

  return (
    <ResponsiveContainer>
      <View style="pt-24 font-sans">
        <h1 style="text-4xl font-bold text-center mb-10 text-gray-800">🎫 Créer un ticket de transport</h1>

        <form onSubmit={handleSubmit} style="max-w-2xl mx-auto">
          <label style="block mb-4 font-medium text-gray-700">
            Ville de départ :
            <TextInput
              type="text"
              value={depart}
              onChange={(e) => setDepart(e.target.value)}
              style="w-full mt-2 p-3 border rounded"
              required
            />
          </label>

          <label style="block mb-4 font-medium text-gray-700">
            Ville d’arrivée :
            <TextInput
              type="text"
              value={arrivee}
              onChange={(e) => setArrivee(e.target.value)}
              style="w-full mt-2 p-3 border rounded"
              required
            />
          </label>

          <View style="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <label style="block font-medium text-gray-700">
              Date :
              <TextInput
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style="w-full mt-2 p-3 border rounded"
                required
              />
            </label>

            <label style="block font-medium text-gray-700">
              Heure :
              <TextInput
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                style="w-full mt-2 p-3 border rounded"
                required
              />
            </label>
          </View>

          <label style="block mb-6 font-medium text-gray-700">
            Type de transport :
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style="w-full mt-2 p-3 border rounded"
            >
              <option value="bus">🚌 Bus</option>
              <option value="covoiturage">🚗 Covoiturage</option>
              <option value="train">🚆 Train</option>
              <option value="avion">✈️ Avion</option>
            </select>
          </label>

          <TouchableOpacity
            type="submit"
            style="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded"
          >
            ➤ Valider le ticket
          </TouchableOpacity>
        </form>

        <PulseBox>
          <h2 style="text-xl font-bold mb-2 text-gray-800">🤖 Réponse Yukpomnang :</h2>
          <p style="text-gray-700">{iaResponse}</Text>

          <RequireAccess plan="enterprise">
            <View style="mt-4 text-red-600 font-semibold">
              Fonctionnalités avancées réservées aux comptes Premium
            </View>
          </RequireAccess>
        </PulseBox>
      </View>
    </ResponsiveContainer>
  );
};

export default TicketPage;

