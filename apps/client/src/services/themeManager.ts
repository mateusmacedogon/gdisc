/**
 * GDisC Theme & Accent Color Manager
 */

export interface AccentTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  glow: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  {
    id: 'purple',
    name: 'Roxo GDisC (Padrão)',
    primary: '#6C63FF',
    secondary: '#8B84FF',
    glow: '0 0 20px rgba(108, 99, 255, 0.45)',
  },
  {
    id: 'emerald',
    name: 'Verde Esmeralda',
    primary: '#10B981',
    secondary: '#34D399',
    glow: '0 0 20px rgba(16, 185, 129, 0.45)',
  },
  {
    id: 'cyan',
    name: 'Azul Ciano Cyber',
    primary: '#06B6D4',
    secondary: '#22D3EE',
    glow: '0 0 20px rgba(6, 182, 212, 0.45)',
  },
  {
    id: 'rose',
    name: 'Rosa Neon',
    primary: '#F43F5E',
    secondary: '#FB7185',
    glow: '0 0 20px rgba(244, 63, 94, 0.45)',
  },
  {
    id: 'amber',
    name: 'Âmbar Sunset',
    primary: '#F59E0B',
    secondary: '#FBBF24',
    glow: '0 0 20px rgba(245, 158, 11, 0.45)',
  },
];

class ThemeManager {
  private currentThemeId = 'purple';

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gdisc_accent_theme');
      if (saved) {
        this.setTheme(saved);
      }
    }
  }

  public getTheme(): AccentTheme {
    return (
      ACCENT_THEMES.find((t) => t.id === this.currentThemeId) ||
      ACCENT_THEMES[0]
    );
  }

  public setTheme(themeId: string) {
    const theme = ACCENT_THEMES.find((t) => t.id === themeId);
    if (!theme) return;

    this.currentThemeId = theme.id;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gdisc_accent_theme', theme.id);

      const root = document.documentElement;
      root.style.setProperty('--color-brand-primary', theme.primary);
      root.style.setProperty('--color-brand-secondary', theme.secondary);
      root.style.setProperty('--color-brand-glow', theme.glow);
    }
  }
}

export const themeManager = new ThemeManager();
