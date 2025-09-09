// @ts-check
import React from "react";
import banner from "@/assets/banner.png";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { useUser } from "@/hooks/useUser";

const StarterHero: React.FC = () => {
  const { user } = useUser();

  return (
    <section className="relative w-full h-[400px] mt-24">
      <img
        src={banner}
        alt="Yukpomnang bannière"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      <div className="absolute inset-0 z-10 bg-black/50 flex flex-col items-center justify-center text-center px-4">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-5xl text-white font-bold max-w-3xl"
        >
          L’assistant intelligent qui transforme vos besoins en solutions.
        </motion.h1>

        <Link to={user ? ROUTES.SERVICES : ROUTES.REGISTER}>
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 bg-white text-primary px-6 py-3 rounded-full font-medium hover:shadow-xl transition"
          >
            Explorer les services
          </motion.button>
        </Link>
      </div>
    </section>
  );
};

export default StarterHero;
