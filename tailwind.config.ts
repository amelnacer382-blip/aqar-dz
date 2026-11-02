import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /**
         * Palette "Dar" — tiree du patio d'une maison de la Casbah d'Alger :
         * murs a la chaux, bleu des zelliges, ocre des pilastres peints.
         * Ces teintes portent l'identite ; le slate de shadcn reste utilise
         * pour les surfaces neutres des ecrans de gestion.
         */
        dar: {
          ink: "#12212B",      // ombre des arcades — texte et fonds sombres
          blue: "#1E5F74",     // bleu des zelliges — action principale
          "blue-dark": "#174C5D",
          // Sur fond sombre, le bleu de zellige disparait : cette version
          // eclaircie porte l'accent des titres du heros.
          "blue-light": "#6FBAD2",
          "blue-soft": "#DDE9EC",
          lime: "#F4F5F3",     // badigeon de chaux — fond de page
          sand: "#E7E3DA",     // pierre — separateurs
          ochre: "#C8892F",    // pilastre peint — accent, avec parcimonie
          terra: "#9C4A2F",    // terre cuite du zellige — emphase rare
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        arch: "0 24px 60px -28px rgba(18, 33, 43, 0.45)",
        card: "0 1px 2px rgba(18, 33, 43, 0.04), 0 8px 24px -16px rgba(18, 33, 43, 0.18)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        /* Bande des wilayas : la piste est dupliquee, -50% boucle sans saut. */
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        /* Seconde ligne, sens inverse : deux courants au lieu d'un defile. */
        "marquee-reverse": {
          from: { transform: "translateX(-50%)" },
          to: { transform: "translateX(0)" },
        },
        /* Respiration lente d'une photographie fixe (panneau des ecrans de connexion). */
        "ken-burns": {
          "0%": { transform: "scale(1) translate3d(0, 0, 0)" },
          "100%": { transform: "scale(1.12) translate3d(0, -1.5%, 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "rise-in": "rise-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        marquee: "marquee 46s linear infinite",
        "marquee-reverse": "marquee-reverse 62s linear infinite",
        "ken-burns": "ken-burns 26s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config