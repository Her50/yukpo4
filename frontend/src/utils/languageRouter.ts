export function getUserLocale(): string {
  const navLang = navigator.language || "fr";
  if (navLang.startsWith("fr")) return "fr";
  if (navLang.startsWith("en")) return "en";
  if (navLang.startsWith("ff") || navLang.startsWith("pul")) return "ff";
  return "fr";
}