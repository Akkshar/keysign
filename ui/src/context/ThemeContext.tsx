import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // index.html has already read this and put the class on <html> before the first
  // paint. Read it back the same way so React's first render agrees with what is
  // already on screen; disagreeing is what made the window flash light then dark.
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('keysign-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch { /* private mode */ }
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    root.style.backgroundColor = theme === 'dark' ? '#121210' : '#faf8f5';
    try { localStorage.setItem('keysign-theme', theme); } catch { /* private mode */ }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
