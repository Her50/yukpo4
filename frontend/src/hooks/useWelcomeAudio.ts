import { useEffect } from 'react';
export function useWelcomeAudio(language: string) {
  useEffect(() => {
    const played = localStorage.getItem("welcome_audio_played");
    if (!played) {
      const audio = new Audio(`/audio/welcome_${language}.mp3`);
      audio.volume = 0.7;
      audio.play().catch(() => {});
      localStorage.setItem("welcome_audio_played", "true");
    }
  }, [language]);
}
