// @ts-check
import { translations } from "@/i18n/translations";
import { getUserLocale } from "@/utils/languageRouter";

interface Props {
  id: string;
}

export default function LocalizedText({ id }: Props) {
  const locale = getUserLocale() as keyof typeof translations;

  const dict = translations[locale] as Record<string, string>;
  const fallback = translations["fr"] as Record<string, string>;

  return <>{dict[id] || fallback[id] || id}</>;
}
