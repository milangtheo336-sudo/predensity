'use client';

import * as React from 'react';
import { Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === 'dark' : false;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setTheme(isDark ? 'light' : 'dark');
      }}
      className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-sm transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <Moon className="w-4 h-4 text-blue-500" />
        <span>Dark mode</span>
      </div>
      <div
        className={`relative w-10 h-6 rounded-full transition-colors ${
          isDark ? 'bg-vibrant-purple' : 'bg-gray-300 dark:bg-neutral-600'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            isDark ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </div>
    </button>
  );
}
