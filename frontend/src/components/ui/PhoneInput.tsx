// 📁 src/components/ui/PhoneInput.tsx
import React from "react";
import { Input } from "@/components/ui/input";

interface PhoneInputProps {
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  value = "",
  onChange,
  placeholder = "+237 690000000",
  label,
  required = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Validation stricte : + optionnel au début, puis uniquement des chiffres
    const regex = /^\+?\d*$/;
    if (val === '' || regex.test(val)) {
      if (onChange) onChange(val);
    }
  };

  return (
    <div className="space-y-1">
      {/* Label supprimé car géré par DynamicField */}
      <Input
        type="tel"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        required={required}
        pattern="^\\+?\\d+$"
        className="tracking-wide w-full text-xs h-8 px-2 border-gray-300 bg-white focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
      />
    </div>
  );
};

export default PhoneInput;
