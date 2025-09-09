import { useEffect } from "react";

export function WelcomeSound({ language }: { language: string }) {
  useEffect(() => {
    const audio = new Audio(`/audio/welcome_${language || "fr"}.mp3`);
    audio.play().catch(() => {});
  }, [language]);

  return null;
}

export default WelcomeSound;
