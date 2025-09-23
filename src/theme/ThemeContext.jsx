import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { createPixelPilotTheme } from './themes';

// Theme Context
const ThemeContext = createContext({
  themeMode: 'light',
  toggleTheme: () => {},
  isDarkMode: false,
});

// Theme Provider Component
export const PixelPilotThemeProvider = ({ children }) => {
  // Get initial theme from localStorage or default to light
  const [themeMode, setThemeMode] = useState(() => {
    const savedTheme = localStorage.getItem('pixel-pilot-theme');
    return savedTheme || 'light';
  });

  // Create theme based on current mode
  const theme = createPixelPilotTheme(themeMode);
  const isDarkMode = themeMode === 'dark';

  // Toggle theme function
  const toggleTheme = () => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
    localStorage.setItem('pixel-pilot-theme', newMode);
  };

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('pixel-pilot-theme', themeMode);
  }, [themeMode]);

  const contextValue = {
    themeMode,
    toggleTheme,
    isDarkMode,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a PixelPilotThemeProvider');
  }
  return context;
};

export default ThemeContext;