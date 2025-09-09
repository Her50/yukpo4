import React from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  defaultValue?: string;
  onValueChange: (value: string) => void;
}

export const Select: React.FC<SelectProps> = ({ options, defaultValue, onValueChange }) => {
  return (
    <select
      defaultValue={defaultValue}
      onChange={(e) => onValueChange(e.target.value)}
      className="text-sm px-2 py-1 border rounded"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
