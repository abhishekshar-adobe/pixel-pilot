import { createTheme } from '@mui/material/styles';

// PixelPilot Custom Theme
export const pixelPilotTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb', // Clean blue
      light: '#3b82f6',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6b7280', // Clean gray
      light: '#9ca3af',
      dark: '#4b5563',
      contrastText: '#ffffff',
    },
    success: {
      main: '#059669', // Clean green
      light: '#10b981',
      dark: '#047857',
    },
    warning: {
      main: '#d97706', // Clean orange
      light: '#f59e0b',
      dark: '#b45309',
    },
    error: {
      main: '#dc2626', // Clean red
      light: '#ef4444',
      dark: '#b91c1c',
    },
    info: {
      main: '#0891b2', // Clean cyan
      light: '#06b6d4',
      dark: '#0e7490',
    },
    background: {
      default: '#ffffff', // Pure white background
      paper: '#ffffff',
    },
    text: {
      primary: '#111827', // Very dark gray for high contrast
      secondary: '#6b7280', // Medium gray
    },
    divider: '#e5e7eb', // Light gray divider
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.025em',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 500,
      textTransform: 'none',
      fontSize: '0.875rem',
    },
  },
  shape: {
    borderRadius: 0, // Sharp corners, no rounded borders
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
          padding: '10px 20px',
          fontSize: '0.875rem',
          fontWeight: 500,
          textTransform: 'none',
          boxShadow: 'none',
          border: '1px solid transparent',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          backgroundColor: '#2563eb',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#1d4ed8',
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: '#e5e7eb',
          color: '#374151',
          '&:hover': {
            borderColor: '#2563eb',
            backgroundColor: '#f9fafb',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
          boxShadow: 'none',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0, // Sharp corners
            backgroundColor: '#ffffff',
            '& fieldset': {
              borderColor: '#e5e7eb',
            },
            '&:hover fieldset': {
              borderColor: '#9ca3af',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#2563eb',
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
          boxShadow: 'none',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
          fontWeight: 500,
          border: '1px solid #e5e7eb',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
          fontSize: '0.875rem',
          border: '1px solid',
          borderColor: 'currentColor',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
          height: 6,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: 'none',
          border: '1px solid #e5e7eb',
          '&:before': {
            display: 'none',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          boxShadow: 'none',
          border: '1px solid #e5e7eb',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          borderRadius: 0,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 48,
          borderRadius: 0,
          '&.Mui-selected': {
            color: '#2563eb',
            fontWeight: 600,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: '#2563eb',
          height: 2,
        },
      },
    },
  },
});

export default pixelPilotTheme;
