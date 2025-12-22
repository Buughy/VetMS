import { useTheme } from './ThemeContext';

export interface ThemeColors {
    bgPrimary: string;
    bgSecondary: string;
    textPrimary: string;
}

export function useThemeColors() {
    const { colors, updateColors, resetColors, isDefaultColors } = useTheme();

    return {
        colors,
        updateColors,
        resetColors,
        isDefault: isDefaultColors,
    };
}
