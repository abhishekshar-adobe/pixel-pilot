import React from 'react';
import {
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Box,
  Typography,
} from '@mui/material';
import {
  LightMode,
  DarkMode,
  Brightness4,
} from '@mui/icons-material';
import { useTheme } from '../theme/ThemeContext.jsx';

// Simple Toggle Button Switcher
export const ThemeToggleButton = ({ size = 'medium', showTooltip = true }) => {
  const { toggleTheme, isDarkMode } = useTheme();

  const button = (
    <IconButton
      onClick={toggleTheme}
      size={size}
      sx={{
        color: isDarkMode ? '#ffbc00' : '#f59e0b',
        backgroundColor: isDarkMode 
          ? 'rgba(255, 188, 0, 0.1)' 
          : 'rgba(245, 158, 11, 0.1)',
        '&:hover': {
          backgroundColor: isDarkMode 
            ? 'rgba(255, 188, 0, 0.2)' 
            : 'rgba(245, 158, 11, 0.2)',
          transform: 'scale(1.05)',
        },
        transition: 'all 0.2s ease-in-out',
        border: '1px solid',
        borderColor: isDarkMode 
          ? 'rgba(255, 188, 0, 0.3)' 
          : 'rgba(245, 158, 11, 0.3)',
      }}
    >
      {isDarkMode ? (
        <LightMode fontSize="inherit" />
      ) : (
        <DarkMode fontSize="inherit" />
      )}
    </IconButton>
  );

  return showTooltip ? (
    <Tooltip title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}>
      {button}
    </Tooltip>
  ) : (
    button
  );
};

// Switch Style Toggler
export const ThemeSwitch = ({ label = true, size = 'medium' }) => {
  const { toggleTheme, isDarkMode } = useTheme();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {label && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LightMode 
            sx={{ 
              fontSize: 16, 
              color: !isDarkMode ? 'primary.main' : 'text.secondary' 
            }} 
          />
          <Typography 
            variant="body2" 
            sx={{ 
              color: !isDarkMode ? 'primary.main' : 'text.secondary',
              fontWeight: !isDarkMode ? 600 : 400
            }}
          >
            Light
          </Typography>
        </Box>
      )}
      
      <Switch
        checked={isDarkMode}
        onChange={toggleTheme}
        size={size}
        sx={{
          '& .MuiSwitch-switchBase': {
            '&.Mui-checked': {
              color: '#ffbc00',
              '& + .MuiSwitch-track': {
                backgroundColor: '#262936',
                border: '1px solid #3a3f5c',
              },
            },
          },
          '& .MuiSwitch-track': {
            backgroundColor: '#e2e8f0',
            border: '1px solid #cbd5e1',
          },
        }}
      />
      
      {label && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <DarkMode 
            sx={{ 
              fontSize: 16, 
              color: isDarkMode ? 'primary.main' : 'text.secondary' 
            }} 
          />
          <Typography 
            variant="body2" 
            sx={{ 
              color: isDarkMode ? 'primary.main' : 'text.secondary',
              fontWeight: isDarkMode ? 600 : 400
            }}
          >
            Dark
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Compact Theme Indicator
export const ThemeIndicator = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: '0.5rem',
        backgroundColor: isDarkMode 
          ? 'rgba(96, 165, 250, 0.1)' 
          : 'rgba(59, 130, 246, 0.1)',
        border: '1px solid',
        borderColor: isDarkMode 
          ? 'rgba(96, 165, 250, 0.3)' 
          : 'rgba(59, 130, 246, 0.3)',
      }}
    >
      <Brightness4 
        sx={{ 
          fontSize: 14, 
          color: isDarkMode ? '#02c0ce' : '#02c0ce' 
        }} 
      />
      <Typography 
        variant="caption" 
        sx={{ 
          color: isDarkMode ? '#02c0ce' : '#02c0ce',
          fontWeight: 500,
          fontSize: '0.75rem'
        }}
      >
        {isDarkMode ? 'Dark' : 'Light'}
      </Typography>
    </Box>
  );
};

export default { ThemeToggleButton, ThemeSwitch, ThemeIndicator };