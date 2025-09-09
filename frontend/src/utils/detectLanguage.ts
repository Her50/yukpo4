export function detectBrowserLanguage(): string {
  const lang = navigator.language || navigator.languages[0] || "en";
  return lang.split("-")[0];
}
