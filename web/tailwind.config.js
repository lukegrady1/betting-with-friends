import { fontFamily } from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { 
      center: true, 
      padding: "1rem" 
    },
    extend: {
      fontFamily: {
        sans: ["Inter", ...fontFamily.sans],
      },
      borderRadius: { 
        lg: "var(--radius)", 
        xl: "calc(var(--radius) + 0.25rem)", 
        "2xl": "calc(var(--radius) + 0.5rem)" 
      },
      keyframes: {
        shimmer: { 
          "0%": { backgroundPosition: "-200% 0" }, 
          "100%": { backgroundPosition: "200% 0" } 
        },
        spinSmooth: { 
          to: { transform: "rotate(360deg)" } 
        },
      },
      animation: {
        shimmer: "shimmer 1.5s ease-in-out infinite",
        spinSmooth: "spinSmooth 1.2s linear infinite",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { 
          DEFAULT: "hsl(var(--primary))", 
          foreground: "hsl(var(--primary-foreground))" 
        },
        secondary: { 
          DEFAULT: "hsl(var(--secondary))", 
          foreground: "hsl(var(--secondary-foreground))" 
        },
        destructive: { 
          DEFAULT: "hsl(var(--destructive))", 
          foreground: "hsl(var(--destructive-foreground))" 
        },
        muted: { 
          DEFAULT: "hsl(var(--muted))", 
          foreground: "hsl(var(--muted-foreground))" 
        },
        accent: { 
          DEFAULT: "hsl(var(--accent))", 
          foreground: "hsl(var(--accent-foreground))" 
        },
        card: { 
          DEFAULT: "hsl(var(--card))", 
          foreground: "hsl(var(--card-foreground))" 
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};