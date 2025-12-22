import * as React from 'react';

export interface ThemeColors {
    bgPrimary: string;
    bgSecondary: string;
    textPrimary: string;
}

const DEFAULT_COLORS: ThemeColors = {
    bgPrimary: '#0f172a',    // slate-950
    bgSecondary: '#1e293b',  // slate-800
    textPrimary: '#f8fafc',  // slate-50
};

const THEME_STORAGE_KEY = 'vetms-theme';
const COLORS_STORAGE_KEY = 'vetms-dark-theme-colors';

interface ThemeContextType {
    isDark: boolean;
    toggle: () => void;
    colors: ThemeColors;
    updateColors: (newColors: Partial<ThemeColors>) => void;
    resetColors: () => void;
    isDefaultColors: boolean;
}

const ThemeContext = React.createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Initialize isDark from localStorage or system preference
    const [isDark, setIsDark] = React.useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(THEME_STORAGE_KEY);
            if (stored) return stored === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // Initialize colors from localStorage
    const [colors, setColors] = React.useState<ThemeColors>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(COLORS_STORAGE_KEY);
            if (stored) {
                try {
                    return JSON.parse(stored);
                } catch {
                    return DEFAULT_COLORS;
                }
            }
        }
        return DEFAULT_COLORS;
    });

    // Apply dark mode class to <html> element
    React.useEffect(() => {
        const html = document.documentElement;
        if (isDark) {
            html.classList.add('dark');
            localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        } else {
            html.classList.remove('dark');
            localStorage.setItem(THEME_STORAGE_KEY, 'light');
        }
    }, [isDark]);

    // Apply custom colors as CSS variables
    React.useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--theme-bg-primary', colors.bgPrimary);
        root.style.setProperty('--theme-bg-secondary', colors.bgSecondary);
        root.style.setProperty('--theme-text-primary', colors.textPrimary);
        localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(colors));
    }, [colors]);

    const toggle = React.useCallback(() => {
        setIsDark(prev => !prev);
    }, []);

    const updateColors = React.useCallback((newColors: Partial<ThemeColors>) => {
        setColors(prev => ({ ...prev, ...newColors }));
    }, []);

    const resetColors = React.useCallback(() => {
        setColors(DEFAULT_COLORS);
    }, []);

    const isDefaultColors = JSON.stringify(colors) === JSON.stringify(DEFAULT_COLORS);

    const value = React.useMemo(() => ({
        isDark,
        toggle,
        colors,
        updateColors,
        resetColors,
        isDefaultColors,
    }), [isDark, toggle, colors, updateColors, resetColors, isDefaultColors]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = React.useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
