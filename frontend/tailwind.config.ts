import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "fade-in-out": {
          "0%": {
            opacity: "0",
            transform: "translateY(-2px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-down-attention": {
          "0%": { opacity: "0", transform: "translateY(-120%)" },
          "60%": { opacity: "1", transform: "translateY(8px)" },
          "80%": { transform: "translateY(-4px)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-out": "fade-in-out 0.3s ease-in-out",
        "slide-down-attention": "slide-down-attention 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
