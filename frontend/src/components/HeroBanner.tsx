// src/components/HeroBanner.tsx
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import banner from "@/assets/banner.png";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const HeroBanner: React.FC = () => {
  return (
    <section className="relative w-full h-[550px] md:h-[600px] overflow-hidden mt-24">
      {/* Image de fond */}
      <img
        src={banner}
        alt="Yukpomnang background"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Overlay assombri */}
      <div className="absolute inset-0 bg-black/40 z-10" />

      {/* Texte ajusté à gauche */}
      <div className="relative z-20 flex flex-col justify-center h-full max-w-4xl pl-8 pr-4 md:pl-24 text-white text-left">
        <motion.h1
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold leading-snug drop-shadow-xl"
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
            className="inline-block mt-6 bg-white text-black px-6 py-3 rounded-full font-medium hover:bg-gray-100 shadow-lg transition"
          >
            Explorer les services
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroBanner;
