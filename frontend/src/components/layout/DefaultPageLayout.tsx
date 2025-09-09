// src/components/layout/DefaultPageLayout.tsx
import React from "react";

interface Props {
  children: React.ReactNode;
}

const DefaultPageLayout: React.FC<Props> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#fffbea] pt-24 px-4 flex justify-center items-start">
      <div className="w-full max-w-3xl">{children}</div>
    </div>
  );
};

export default DefaultPageLayout;
