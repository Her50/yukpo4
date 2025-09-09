// 📁 src/components/ui/ImageYukpo.tsx
import React from "react";

interface ImageYukpoProps {
  src: string;
  alt?: string;
  className?: string;
}

const ImageYukpo: React.FC<ImageYukpoProps> = ({ src, alt = "Illustration Yukpo", className = "" }) => {
  return (
    <img
      src={src}
      alt={alt}
      className={`rounded-xl object-contain transition-all duration-500 ease-in-out ${className}`}
      loading="lazy"
    />
  );
};

export default ImageYukpo;
