// 📁 src/components/ui/EmailInput.tsx
import React from 'react';
import { Input } from '@/components/ui/input';

interface EmailInputProps {
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

const EmailInput: React.FC<EmailInputProps> = ({
  value = '',
  onChange,
  placeholder = 'exemple@domain.com',
  label,
  required = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (onChange) onChange(val);
  };

  return (
    <div className="space-y-1">
      {/* Label supprimé car géré par DynamicField */}
      <Input
        type="email"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        required={required}
        pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
        className="tracking-wide w-full text-xs h-8 px-2 border-gray-300 bg-white focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
      />
    </div>
  );
};

export default EmailInput;
