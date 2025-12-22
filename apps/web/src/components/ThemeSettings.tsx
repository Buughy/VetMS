import * as React from 'react';
import { useThemeColors } from '../lib/useThemeColors';
import Button from './ui/Button';

export default function ThemeSettings() {
    const { colors, updateColors, resetColors, isDefault } = useThemeColors();
    const [localColors, setLocalColors] = React.useState(colors);

    React.useEffect(() => {
        setLocalColors(colors);
    }, [colors]);

    const handleSave = () => {
        updateColors(localColors);
    };

    const handleReset = () => {
        resetColors();
    };

    const handleColorChange = (key: keyof typeof colors, value: string) => {
        setLocalColors(prev => ({ ...prev, [key]: value }));
    };

    const hasChanges = JSON.stringify(localColors) !== JSON.stringify(colors);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-slate-900 dark:text-theme-text-primary">
                    Dark Mode Theme Customization
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleReset}
                        disabled={isDefault}
                        variant="secondary"
                    >
                        Reset to Defaults
                    </Button>
                    <Button onClick={handleSave} disabled={!hasChanges}>
                        Save Theme
                    </Button>
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-theme-bg-secondary">
                <p className="mb-4 text-sm text-slate-600 dark:text-theme-text-primary opacity-80">
                    Customize the colors for dark mode. These colors will apply across the entire application when dark mode is active.
                </p>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {/* Background Primary */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">
                            Background Color 1
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={localColors.bgPrimary}
                                onChange={(e) => handleColorChange('bgPrimary', e.target.value)}
                                className="h-10 w-20 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                            />
                            <input
                                type="text"
                                value={localColors.bgPrimary}
                                onChange={(e) => handleColorChange('bgPrimary', e.target.value)}
                                className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-theme-bg-primary dark:text-theme-text-primary"
                                placeholder="#0f172a"
                            />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                            Main background color
                        </p>
                    </div>

                    {/* Background Secondary */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">
                            Background Color 2
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={localColors.bgSecondary}
                                onChange={(e) => handleColorChange('bgSecondary', e.target.value)}
                                className="h-10 w-20 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                            />
                            <input
                                type="text"
                                value={localColors.bgSecondary}
                                onChange={(e) => handleColorChange('bgSecondary', e.target.value)}
                                className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-theme-bg-primary dark:text-theme-text-primary"
                                placeholder="#1e293b"
                            />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                            Cards and secondary backgrounds
                        </p>
                    </div>

                    {/* Text Primary */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">
                            Text Color
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={localColors.textPrimary}
                                onChange={(e) => handleColorChange('textPrimary', e.target.value)}
                                className="h-10 w-20 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                            />
                            <input
                                type="text"
                                value={localColors.textPrimary}
                                onChange={(e) => handleColorChange('textPrimary', e.target.value)}
                                className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-theme-bg-primary dark:text-theme-text-primary"
                                placeholder="#f8fafc"
                            />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                            Primary text color
                        </p>
                    </div>
                </div>

                {/* Preview */}
                <div className="mt-6">
                    <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-theme-text-primary">
                        Preview
                    </label>
                    <div
                        className="rounded-lg border p-4"
                        style={{
                            backgroundColor: localColors.bgPrimary,
                            borderColor: localColors.bgSecondary,
                        }}
                    >
                        <h3
                            className="text-lg font-semibold"
                            style={{ color: localColors.textPrimary }}
                        >
                            Sample Heading
                        </h3>
                        <p
                            className="mt-2 text-sm opacity-80"
                            style={{ color: localColors.textPrimary }}
                        >
                            This is how your text will look with the selected colors.
                        </p>
                        <div
                            className="mt-3 rounded p-3"
                            style={{ backgroundColor: localColors.bgSecondary }}
                        >
                            <p
                                className="text-sm"
                                style={{ color: localColors.textPrimary }}
                            >
                                This is a card or secondary background element.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
