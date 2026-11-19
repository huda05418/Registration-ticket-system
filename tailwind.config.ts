import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gform: {
          purple: "#673ab7",
          purpleDark: "#512da8",
          purpleLight: "#ede7f6",
          bg: "#f0ebf8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
