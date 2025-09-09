import React, { useEffect, useState } from "react";

const ModeToggle: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const classList = document.documentElement.classList;
    darkMode ? classList.add("dark") : classList.remove("dark");
  }, [darkMode]);

  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="border px-3 py-1 rounded-full text-sm font-medium shadow bg-white dark:bg-gray-800 dark:text-white"
    >
      {darkMode ? "🌙 Sombre" : "☀️ Clair"}
    </button>
  );
};

export default ModeToggle;
