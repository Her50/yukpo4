import React from "react";
import clsx from "clsx";

interface LogoYukpoProps {
  size?: number;
  className?: string;
}

const LogoYukpo: React.FC<LogoYukpoProps> = ({ size = 32, className }) => {
  return (
    <img
      src="/assets/yukpo-logo.svg"
      alt="Logo Yukpo"
      width={size}
      height={size}
      className={clsx("object-contain", className)}
    />
  );
};

export default LogoYukpo;
