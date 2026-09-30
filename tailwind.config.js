/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#667085",
        line: "#E6E9EF",
        canvas: "#F7F8FA",
        brand: { 50: "#EFFAF6", 500: "#0C8F6A", 600: "#087555", 700: "#065D44" },
      },
      boxShadow: { soft: "0 1px 2px rgba(16, 24, 40, .04), 0 1px 3px rgba(16, 24, 40, .08)" },
    },
  },
  plugins: [],
};
