// src/components/layout/ResponsiveContainer.tsx
import React from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

const ResponsiveContainer: React.FC<Props> = ({
  children,
  className = "",
  as: Tag = "main",
}) => {
  return (
    <Tag
      className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-hidden ${className}`}
    >
      {children}
    </Tag>
  );
};

export default ResponsiveContainer;
