import React from 'react';

interface DateTimePickerProps {
  defaultValue?: string;
  onChange: (val: string) => void;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({ defaultValue, onChange }) => {
  return (
    <input
      type="datetime-local"
      className="w-full border rounded px-3 py-2"
      defaultValue={defaultValue}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

export default DateTimePicker;
