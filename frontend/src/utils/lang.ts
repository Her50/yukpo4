export function getUserLanguage(): string {
    return localStorage.getItem("preferred_lang") || navigator.language.slice(0, 2) || "fr";
  }
  