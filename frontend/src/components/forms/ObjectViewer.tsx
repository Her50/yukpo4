import React from 'react';

interface ObjectViewerProps {
  valeur?: Record<string, any>;
  onChange?: (val: Record<string, any>) => void;
  readOnly?: boolean;
}

const ObjectViewer: React.FC<ObjectViewerProps> = ({ valeur = {}, onChange, readOnly = false }) => {
  const handleChange = (key: string, value: string) => {
    if (!onChange) return;
    onChange({ ...valeur, [key]: value });
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Données structurées</label>
      <div className="space-y-1">
        {Object.entries(valeur).map(([key, val]) => (
          <div key={key} className="flex gap-2 items-center">
            <span className="text-sm font-medium w-1/4">{key}</span>
            <input
              type="text"
              className="w-3/4 border rounded px-2 py-1"
              value={val}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={readOnly}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ObjectViewer;
