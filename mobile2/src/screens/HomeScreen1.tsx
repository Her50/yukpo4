// src/pages/HomePage.tsx
import * as React from "react";
import { useState } from "react";
import { Text } from 'react-native';
import AppLayout from "@/components/layout/AppLayout";
import StarterHero from "@/components/StarterHero";
import WhyUsSection from "@/components/WhyUsSection";
import TestimonialsAndPartners from "@/components/TestimonialsAndPartners";
import FloatingHelpButton from "@/components/FloatingHelpButton";
import ChatInputPanel from "@/components/intelligence/ChatInputPanel";
import { appelerMoteurIA } from "@/lib/yukpoaclient";
import { MultiModalInput } from "@/types/yukpoIaClient";

const HomePage: React.FC = () => {
  const [chargement, setChargement] = useState(false);

  const handleChatSubmit = async (input: MultiModalInput) => {
    setChargement(true);
    try {
      const result = await appelerMoteurIA(input);
      console.log("Résultat IA:", result);
      // TODO: gérer affichage du plan structuration IA ou redirection vers FormulaireProgressif
    } catch (error) {
      console.error("Erreur IA:", error);
    } finally {
      setChargement(false);
    }
  };

  return (
    <AppLayout padding={false}>
      <StarterHero />
      <main style="bg-white pt-12 space-y-16">
        <section style="max-w-3xl mx-auto px-4">
          <Text style="text-2xl font-bold mb-4">Exprimez votre besoin en langage naturel</Text>
          <ChatInputPanel onSubmit={handleChatSubmit} loading={chargement} />
        </section>
        <WhyUsSection />
        <TestimonialsAndPartners />
      </main>
      <FloatingHelpButton />
    </AppLayout>
  );
};

export default HomePage;





