import { createTheme } from '@mui/material/styles';

// Light Theme (Current)
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3b82f6', // Modern blue
      light: '#60a5fa',
      dark: '#2563eb',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6366f1', // Modern indigo
      light: '#818cf8',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10b981', // Modern green
      light: '#34d399',
      dark: '#059669',
    },
    warning: {
      main: '#f59e0b', // Modern amber
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444', // Modern red
      light: '#f87171',
      dark: '#dc2626',
    },
    info: {
      main: '#06b6d4', // Modern cyan
      light: '#22d3ee',
      dark: '#0891b2',
    },
    background: {
      default: '#f8fafc', // Very light blue-gray
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a', // Modern slate
      secondary: '#475569', // Modern gray
    },
    divider: '#e2e8f0', // Modern slate divider
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.025em', fontSize: '2.5rem', lineHeight: 1.2 },
    h2: { fontWeight: 600, letterSpacing: '-0.025em', fontSize: '2rem', lineHeight: 1.3 },
    h3: { fontWeight: 600, letterSpacing: '-0.025em', fontSize: '1.5rem', lineHeight: 1.4 },
    h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
    h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { fontWeight: 500, textTransform: 'none', fontSize: '0.875rem' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '0.75rem',
          textTransform: 'none',
          fontWeight: 500,
          padding: '0.625rem 1.25rem',
        },
        contained: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '1rem',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '0.75rem',
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
          },
        },
      },
    },
  },
});

// Dark Theme (Based on Material Design dark principles and your reference)
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#60a5fa', // Lighter blue for dark mode
      light: '#93c5fd',
      dark: '#3b82f6',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#818cf8', // Lighter indigo for dark mode
      light: '#a5b4fc',
      dark: '#6366f1',
      contrastText: '#ffffff',
    },
    success: {
      main: '#34d399', // Lighter green for dark mode
      light: '#6ee7b7',
      dark: '#10b981',
    },
    warning: {
      main: '#fbbf24', // Lighter amber for dark mode
      light: '#fcd34d',
      dark: '#f59e0b',
    },
    error: {
      main: '#f87171', // Lighter red for dark mode
      light: '#fca5a5',
      dark: '#ef4444',
    },
    info: {
      main: '#22d3ee', // Lighter cyan for dark mode
      light: '#67e8f9',
      dark: '#06b6d4',
    },
    background: {
      default: '#0f172a', // Dark slate background
      paper: '#1e293b', // Darker slate for cards/papers
    },
    text: {
      primary: '#f1f5f9', // Light slate for primary text
      secondary: '#94a3b8', // Medium slate for secondary text
    },
    divider: '#334155', // Dark slate divider
    // Additional custom colors for dark theme
    grey: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.025em', fontSize: '2.5rem', lineHeight: 1.2, color: '#f1f5f9' },
    h2: { fontWeight: 600, letterSpacing: '-0.025em', fontSize: '2rem', lineHeight: 1.3, color: '#f1f5f9' },
    h3: { fontWeight: 600, letterSpacing: '-0.025em', fontSize: '1.5rem', lineHeight: 1.4, color: '#f1f5f9' },
    h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4, color: '#f1f5f9' },
    h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4, color: '#f1f5f9' },
    h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4, color: '#f1f5f9' },
    body1: { fontSize: '1rem', lineHeight: 1.6, color: '#f1f5f9' },
    body2: { fontSize: '0.875rem', lineHeight: 1.5, color: '#94a3b8' },
    button: { fontWeight: 500, textTransform: 'none', fontSize: '0.875rem' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '0.75rem',
          textTransform: 'none',
          fontWeight: 500,
          padding: '0.625rem 1.25rem',
        },
        contained: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
          },
        },
        outlined: {
          borderColor: '#334155',
          color: '#f1f5f9',
          '&:hover': {
            borderColor: '#60a5fa',
            backgroundColor: 'rgba(96, 165, 250, 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '1rem',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '0.75rem',
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(129, 140, 248, 0.2)',
            color: '#f1f5f9',
          },
          '&.MuiChip-outlined': {
            borderColor: '#334155',
            color: '#f1f5f9',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e293b',
          '& .MuiTabs-indicator': {
            backgroundColor: '#60a5fa',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: '#94a3b8',
          textTransform: 'none',
          '&.Mui-selected': {
            color: '#f1f5f9',
          },
          '&:hover': {
            color: '#f1f5f9',
            backgroundColor: 'rgba(96, 165, 250, 0.1)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#1e293b',
            '& fieldset': {
              borderColor: '#334155',
            },
            '&:hover fieldset': {
              borderColor: '#475569',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#60a5fa',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#94a3b8',
          },
          '& .MuiOutlinedInput-input': {
            color: '#f1f5f9',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '0.75rem',
          '&.MuiAlert-standardError': {
            backgroundColor: 'rgba(248, 113, 113, 0.15)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            color: '#fca5a5',
          },
          '&.MuiAlert-standardWarning': {
            backgroundColor: 'rgba(251, 191, 36, 0.15)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            color: '#fcd34d',
          },
          '&.MuiAlert-standardSuccess': {
            backgroundColor: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            color: '#6ee7b7',
          },
          '&.MuiAlert-standardInfo': {
            backgroundColor: 'rgba(34, 211, 238, 0.15)',
            border: '1px solid rgba(34, 211, 238, 0.3)',
            color: '#67e8f9',
          },
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          color: '#f1f5f9',
          '&:hover': {
            backgroundColor: 'rgba(96, 165, 250, 0.1)',
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: '#f1f5f9',
        },
        secondary: {
          color: '#94a3b8',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#334155',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#0f172a',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#334155',
          color: '#f1f5f9',
        },
        head: {
          backgroundColor: '#0f172a',
          color: '#f1f5f9',
          fontWeight: 600,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#94a3b8',
          '&:hover': {
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            color: '#f1f5f9',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: '#f1f5f9',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          color: '#f1f5f9',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#334155',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#475569',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#60a5fa',
          },
        },
        icon: {
          color: '#94a3b8',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#f1f5f9',
          '&:hover': {
            backgroundColor: 'rgba(96, 165, 250, 0.1)',
          },
        },
      },
    },
  },
});

// Theme creator function
export const createPixelPilotTheme = (mode = 'light') => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

export default { lightTheme, darkTheme, createPixelPilotTheme };