export default {
  content: ["./index.html", "./src/**/*.{js,jsx}", "../shared/src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bybs: {
          blue: "#00337C",
          blueHover: "#1E4B9E",
          navy: "#10233F",
          rose: "#B76E79",
          roseHover: "#9E5A63",
          gold: "#FFD166",
          page: "#F7F9FC",
          pale: "#F5F9FF",
          blush: "#FFF0F0",
          text: "#111827",
          body: "#374151",
          muted: "#6B7280",
          border: "#E5E7EB"
        }
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "ui-serif", "serif"]
      }
    }
  },
  plugins: []
};
