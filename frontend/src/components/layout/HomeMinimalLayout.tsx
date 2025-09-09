import React from "react";
import ModeToggle from "@/components/ui/ModeToggle";
import { motion } from "framer-motion";

const HomeMinimalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-slate-100 dark:from-black dark:to-gray-900">
      <div className="flex justify-between items-center p-4 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-primary dark:text-white">Yukpo</h1>
        <ModeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl mx-auto px-6"
      >
        <h2 className="text-3xl font-bold mb-4 dark:text-white">Une demande. Une solution. Instantanément.</h2>
        <p className="text-gray-600 dark:text-gray-300 text-lg mb-6">
          Démarrez sans effort. Exprimez votre besoin et laissez l'IA Yukpo agir.
        </p>
      </motion.div>

      <motion.div
        className="flex justify-center mt-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <img
          src="/assets/yukpo-illustration.svg"
          alt="Illustration Yukpo"
          className="w-[420px] h-auto"
        />
      </motion.div>

      <div className="mt-10 px-6">{children}</div>
    </div>
  );
};

export default HomeMinimalLayout;
