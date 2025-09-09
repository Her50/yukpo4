import { useState } from "react";
import axios from "axios";

export function useTranslator() {
  const [translated, setTranslated] = useState("");

  const translate = async (text: string, lang: string) => {
    const res = await axios.post("/translate", { text, target_lang: lang });
    setTranslated(res.data.translated_text);
  };

  return { translated, translate };
}