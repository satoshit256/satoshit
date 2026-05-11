/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05070a",
        fg: "#d8ffe6",
        phosphor: "#00ff88",
        "phosphor-dim": "#00b35c",
        "phosphor-faint": "#003a1e",
        amber: "#ffcc33",
        "amber-dim": "#b38a20",
        muted: "#60766b",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 8px rgba(0,255,136,.5), 0 0 18px rgba(0,255,136,.25)",
      },
    },
  },
  plugins: [],
};
