const brandScale = (name) => ({
  50: `hsl(var(--brand-${name}-50) / <alpha-value>)`,
  100: `hsl(var(--brand-${name}-100) / <alpha-value>)`,
  200: `hsl(var(--brand-${name}-200) / <alpha-value>)`,
  300: `hsl(var(--brand-${name}-300) / <alpha-value>)`,
  400: `hsl(var(--brand-${name}-400) / <alpha-value>)`,
  500: `hsl(var(--brand-${name}-500) / <alpha-value>)`,
  600: `hsl(var(--brand-${name}-600) / <alpha-value>)`,
  700: `hsl(var(--brand-${name}-700) / <alpha-value>)`,
  800: `hsl(var(--brand-${name}-800) / <alpha-value>)`,
  900: `hsl(var(--brand-${name}-900) / <alpha-value>)`,
});

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist Sans', 'Segoe UI', 'Arial', 'sans-serif'],
        heading: ['Geist Sans', 'Segoe UI', 'Arial', 'sans-serif'],
        brand: ['Poppins', 'Geist Sans', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['Consolas', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: "12px",
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
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
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // Semantic custom variables
        'text-primary': "hsl(var(--text-primary))",
        'text-secondary': "hsl(var(--text-secondary))",
        'text-muted': "hsl(var(--text-muted))",
        'text-placeholder': "hsl(var(--text-placeholder))",
        'primary-hover': "hsl(var(--primary-hover))",
        'success': "hsl(var(--success))",
        'danger': "hsl(var(--danger))",
        'focus-ring': "hsl(var(--focus-ring))",
        brand: {
          primary: brandScale('primary'),
          grey: brandScale('grey'),
          coral: brandScale('coral'),
          turquoise: brandScale('turquoise'),
          rajah: brandScale('rajah'),
          indigo: brandScale('indigo'),
          blue: brandScale('blue'),
          red: brandScale('red'),
          green: brandScale('green'),
          surface: "hsl(var(--brand-surface) / <alpha-value>)",
          "surface-subtle": "hsl(var(--brand-surface-subtle) / <alpha-value>)",
          "surface-muted": "hsl(var(--brand-surface-muted) / <alpha-value>)",
          border: "hsl(var(--brand-border-soft) / <alpha-value>)",
        },
      },
      boxShadow: {
        genesis: "0 8px 30px rgba(0, 0, 0, 0.08)",
        brand: "var(--brand-shadow-sm)",
        "brand-md": "var(--brand-shadow-md)",
        "brand-primary": "var(--brand-shadow-primary)",
      }
    },
  },
  plugins: [],
}
