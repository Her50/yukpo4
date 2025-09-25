// @ts-check
import React from "react";
import banner from "@/assets/banner.png";
import { motion } // Animation React Native;

const HeroSection: React.FC = () => {
  return (
    <section style="relative w-full h-[400px] overflow-hidden">
      {/* Image de fond */}
      <img
        src={banner}
        alt="Bannière Yukpomnang"
        style="absolute top-0 left-0 w-full h-full object-cover z-0"
      />

      {/* Couche foncée + Texte centré */}
      <View style="absolute top-0 left-0 w-full h-full z-10 bg-black/40 flex items-center justify-center">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style="text-white text-3xl md:text-5xl font-bold text-center px-4 max-w-3xl"
        >
          Chez Yukpomnang, chaque besoin est une opportunité
        </motion.h1>
      </View>
    </section>
  );
};

export default HeroSection;

