import React from 'react';

interface Props {
  animation: string;
}

const AnimationDebugger: React.FC<Props> = ({ animation }) => {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: '#333',
        color: '#fff',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        fontFamily: 'monospace',
        opacity: 0.7,
        zIndex: 9999,
      }}
    >
      🧪 Animation: {animation}
    </div>
  );
};

export default AnimationDebugger;
