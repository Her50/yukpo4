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

// Radix-compatible stubs for pages that use the decomposed API
export const SelectTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }> = ({ children, ...props }) => (
  <button type="button" className="flex items-center justify-between text-sm px-2 py-1 border rounded" {...props}>{children}</button>
);
export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => <span>{placeholder}</span>;
export const SelectContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
export const SelectItem: React.FC<{ value: string; children?: React.ReactNode }> = ({ value, children }) => (
  <option value={value}>{children}</option>
);
