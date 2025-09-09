import React from 'react';

interface DataDebuggerProps {
  data: any;
  title?: string;
}

const DataDebugger: React.FC<DataDebuggerProps> = ({ data, title = "Données de débogage" }) => {
  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-4">
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <pre className="text-xs overflow-auto max-h-96 bg-white p-2 rounded border">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

export default DataDebugger; 