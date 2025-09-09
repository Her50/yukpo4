import { useContext } from "react";
import { ToastContext } from "@/components/ui/toaster";

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToasterProvider");
  return context;
}
