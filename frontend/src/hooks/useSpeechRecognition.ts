// @ts-check
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
};

const useSpeechRecognition = (): string => {
  const [transcript, setTranscript] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "fr-FR";

    const handleResult = (event: SpeechRecognitionEvent) => {
      const text = Array.from(event.results)
        .map((r) => r[0].transcript.toLowerCase())
        .join("")
        .trim();

      setTranscript(text);

      // 🔁 Commandes vocales reconnues
      if (text.includes("aller au dashboard")) {
        navigate("/dashboard");
      }
      if (text.includes("page d'accueil") || text.includes("accueil")) {
        navigate("/about");
      }
      if (text.includes("profil")) {
        navigate("/dashboard/monprofil");
      }
      if (text.includes("contact")) {
        navigate("/contact");
      }
    };

    recognition.addEventListener("result", handleResult);
    recognition.start();

    return () => {
      recognition.removeEventListener("result", handleResult);
      recognition.abort();
    };
  }, [navigate]);

  return transcript;
};

export default useSpeechRecognition;
