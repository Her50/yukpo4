// @ts-check
import RequireAccess from '@/components/auth/RequireAccess';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import React from 'react';
import { Text, View } from 'react-native';
import styled, { keyframes } from 'styled-components';

// Animation pulsante
const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.75; }
  100% { transform: scale(1); opacity: 1; }
`;

const PulseBox = styled.div`
  animation: ${pulseAnimation} 2s infinite;
  padding: 20px;
  text-align: center;
  background-color: #f3f4f6;
  border-radius: 12px;
  margin: 40px auto;
  width: 300px;
  font-size: 18px;
  font-weight: bold;
`;

const OutilsPage: React.FC = () => {
  return (
    <RequireAccess role="user" plan="pro">
      <ResponsiveContainer>
        <View style="pt-24 min-h-screen bg-white font-sans">
          <Text style="text-3xl text-center mb-10 font-bold">🛠️ Outils Yukpomnang</Text>
          <View>⚙️ Module Yukpomnang en cours d'activation...</View>
        </View>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default OutilsPage;





