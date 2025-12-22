import { useTheme } from './ThemeContext';

export function useDarkMode() {
    const { isDark, toggle } = useTheme();
    return { isDark, toggle };
}
