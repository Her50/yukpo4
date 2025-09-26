// src/components/HeroBanner.tsx
import { Link } from "@react-navigation/native";
import * as React from "react";
import { View } from 'react-native';
// import { motion } from 'framer-motion'; // Animation React Native
// import banner from "@/assets/banner.png";
// import { ROUTES } from "@/routes/AppRoutesRegistry";

const HeroBanner: React.FC = () => {
  return (
    <section style="relative w-full h-[550px] md:h-[600px] overflow-hidden mt-24">
      {/* Image de fond */}
      <img
        src={banner}
        alt="Yukpomnang background"
        style="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Overlay assombri */}
      <View style="absolute inset-0 bg-black/40 z-10" />

      {/* Texte ajusté à gauche */}
      <View style="relative z-20 flex flex-col justify-center h-full max-w-4xl pl-8 pr-4 md:pl-24 text-white text-left">
        <motion.h1
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          style="text-3xl sm:text-4xl md:text-5xl font-bold leading-snug drop-shadow-xl"
        >
          L’assistant intelligent<br />
          qui transforme vos besoins<br />
          en solutions.
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Link
            to={ROUTES.SERVICES}
            style="inline-block mt-6 bg-white text-black px-6 py-3 rounded-full font-medium hover:bg-gray-100 shadow-lg transition"
          >
            Explorer les services
          </Link>
        </motion.div>
      </View>
    </section>
  );
};

export default HeroBanner;





