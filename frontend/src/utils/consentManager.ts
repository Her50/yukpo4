export function saveConsent(consent: Record<string, boolean>) {
  localStorage.setItem("yuk_consent", JSON.stringify(consent));
}
export function getConsent(): Record<string, boolean> {
  return JSON.parse(localStorage.getItem("yuk_consent") || "{}");
}