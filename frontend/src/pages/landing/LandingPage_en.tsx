import React from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";

const LandingPage_en: React.FC = () => {
  return (
    <ResponsiveContainer>
      <div className="p-4">
        <h2 className="text-2xl font-bold">🌍 Welcome to Yukpo</h2>
        <p className="text-gray-600 mt-2">
          Your intelligent platform for services, automation, and more – powered by AI.
        </p>
      </div>
    </ResponsiveContainer>
  );
};

export default LandingPage_en;
