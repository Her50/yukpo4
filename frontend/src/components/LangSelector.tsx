import React from "react";
import { useTranslation } from "react-i18next";

const LangSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("lng", lng);
  };

  return (
    <select
      onChange={(e) => changeLanguage(e.target.value)}
      defaultValue={i18n.language}
      className="rounded p-1 border"
    >
      <option value="fr">🇫🇷 Français</option>
      <option value="en">🇬🇧 English</option>
      <option value="ff">🌍 Fulfulde</option>
      <option value="ar">🇸🇦 العربية</option>
      <option value="pt">🇵🇹 Português</option>
    </select>
  );
};

export default LangSelector;
