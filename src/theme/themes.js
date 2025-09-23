import { createTheme } from '@mui/material/styles';

// Light Theme (Current)
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6366f1', // Modern indigo
      light: '#818cf8',
      dark: '#4f46e5',
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
    components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '0.375rem',
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
          padding: '0.5rem 1rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
          },
        },
        contained: {
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
        outlined: {
          borderColor: '#3a3f5c',
          color: '#aab8c5',
          '&:hover': {
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
          },
        },
        text: {
          color: '#8391a2',
          '&:hover': {
            backgroundColor: 'rgba(114, 124, 245, 0.08)',
            color: '#aab8c5',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          backgroundColor: '#262936',
          border: '1px solid #3a3f5c',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '0.375rem',
          fontSize: '0.75rem',
          fontWeight: 500,
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            color: '#6366f1',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          },
          '&.MuiChip-outlined': {
            borderColor: '#3a3f5c',
            color: '#aab8c5',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          backgroundColor: '#262936',
          borderBottom: '1px solid #3a3f5c',
          '& .MuiTabs-indicator': {
            backgroundColor: '#6366f1',
            height: '2px',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: '#8391a2',
          textTransform: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          minHeight: '48px',
          '&.Mui-selected': {
            color: '#6366f1',
          },
          '&:hover': {
            color: '#aab8c5',
            backgroundColor: 'rgba(99, 102, 241, 0.05)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#1a1d29',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            '& fieldset': {
              borderColor: '#3a3f5c',
            },
            '&:hover fieldset': {
              borderColor: '#495057',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#6366f1',
            },
            '& input': {
              color: '#aab8c5',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#8391a2',
            fontSize: '0.875rem',
            '&.Mui-focused': {
              color: '#6366f1',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#262936',
          borderRadius: '0.5rem',
          border: '1px solid #3a3f5c',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1d29',
          '& .MuiTableCell-head': {
            backgroundColor: '#1a1d29',
            borderBottom: '1px solid #3a3f5c',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#3a3f5c',
          color: '#aab8c5',
          fontSize: '0.875rem',
        },
        head: {
          backgroundColor: '#1a1d29',
          color: '#aab8c5',
          fontWeight: 600,
          fontSize: '0.8125rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#8391a2',
          borderRadius: '0.375rem',
          '&:hover': {
            backgroundColor: 'rgba(114, 124, 245, 0.08)',
            color: '#aab8c5',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          '&.MuiAlert-standardError': {
            backgroundColor: 'rgba(250, 92, 124, 0.1)',
            border: '1px solid rgba(250, 92, 124, 0.2)',
            color: '#fa5c7c',
          },
          '&.MuiAlert-standardWarning': {
            backgroundColor: 'rgba(255, 188, 0, 0.1)',
            border: '1px solid rgba(255, 188, 0, 0.2)',
            color: '#ffbc00',
          },
          '&.MuiAlert-standardSuccess': {
            backgroundColor: 'rgba(10, 207, 151, 0.1)',
            border: '1px solid rgba(10, 207, 151, 0.2)',
            color: '#0acf97',
          },
          '&.MuiAlert-standardInfo': {
            backgroundColor: 'rgba(57, 175, 209, 0.1)',
            border: '1px solid rgba(57, 175, 209, 0.2)',
            color: '#39afd1',
          },
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          color: '#aab8c5',
          borderRadius: '0.375rem',
          margin: '0.125rem 0',
          '&:hover': {
            backgroundColor: 'rgba(114, 124, 245, 0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(114, 124, 245, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(114, 124, 245, 0.15)',
            },
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: '#aab8c5',
          fontSize: '0.875rem',
          fontWeight: 500,
        },
        secondary: {
          color: '#8391a2',
          fontSize: '0.8125rem',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#3a3f5c',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#262936',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          borderBottom: '1px solid #3a3f5c',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          backgroundColor: '#262936',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1d29',
          borderRadius: '0.375rem',
          color: '#aab8c5',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3a3f5c',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#495057',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#6366f1',
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#aab8c5',
          fontSize: '0.875rem',
          '&:hover': {
            backgroundColor: 'rgba(114, 124, 245, 0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(114, 124, 245, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(114, 124, 245, 0.15)',
            },
          },
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
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: '0.75rem',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.15)',
            borderColor: '#6366f1',
            borderWidth: '2px',
          },
          '&:hover': {
            borderColor: '#6366f1',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 8px -2px rgba(99, 102, 241, 0.12)',
          },
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          color: '#ffffff',
          borderRadius: '0.75rem 0.75rem 0 0',
          minHeight: '64px',
          '&.Mui-expanded': {
            minHeight: '64px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
          },
          '&:hover': {
            background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
          },
          '& .MuiAccordionSummary-content': {
            margin: '12px 0',
            alignItems: 'center',
          },
          '& .MuiAccordionSummary-expandIconWrapper': {
            color: '#ffffff',
            opacity: 0.8,
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            '&.Mui-expanded': {
              transform: 'rotate(180deg)',
            },
            '&:hover': {
              opacity: 1,
            },
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: '24px',
          backgroundColor: '#f8fafc',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          borderRadius: '0 0 0.75rem 0.75rem',
        },
      },
    },
  },
});

// Dark Theme (Based on HighDmin reference design)
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Modern indigo primary
      light: '#9da3f6',
      dark: '#5a64e8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6c757d', // Neutral gray
      light: '#868e96',
      dark: '#495057',
      contrastText: '#ffffff',
    },
    success: {
      main: '#0acf97', // Bright green
      light: '#2dd4aa',
      dark: '#08a679',
    },
    warning: {
      main: '#ffbc00', // Bright yellow/amber
      light: '#ffca28',
      dark: '#f57c00',
    },
    error: {
      main: '#fa5c7c', // Bright red/pink
      light: '#fb7a9a',
      dark: '#f8285a',
    },
    info: {
      main: '#39afd1', // Bright cyan
      light: '#64c5e0',
      dark: '#2e8ba6',
    },
    background: {
      default: '#1a1d29', // Very dark blue-gray background
      paper: '#262936', // Slightly lighter dark blue-gray for cards
    },
    text: {
      primary: '#aab8c5', // Light blue-gray for primary text
      secondary: '#8391a2', // Medium blue-gray for secondary text
    },
    divider: '#3a3f5c', // Dark blue-gray divider
    // Custom grays matching the reference
    grey: {
      50: '#f8f9fa',
      100: '#f1f3f4',
      200: '#e3e6ea',
      300: '#ced4da',
      400: '#adb5bd',
      500: '#6c757d',
      600: '#495057',
      700: '#343a40',
      800: '#212529',
      900: '#1a1d29',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 600, fontSize: '2.5rem', lineHeight: 1.2, color: '#aab8c5' },
    h2: { fontWeight: 600, fontSize: '2rem', lineHeight: 1.3, color: '#aab8c5' },
    h3: { fontWeight: 600, fontSize: '1.75rem', lineHeight: 1.3, color: '#aab8c5' },
    h4: { fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.4, color: '#aab8c5' },
    h5: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4, color: '#aab8c5' },
    h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4, color: '#aab8c5' },
    body1: { fontSize: '0.875rem', lineHeight: 1.5, color: '#aab8c5' },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5, color: '#8391a2' },
    button: { fontWeight: 500, textTransform: 'none', fontSize: '0.875rem' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '0.375rem',
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
          padding: '0.5rem 1rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
          },
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
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: '0.75rem',
          backgroundColor: '#262936',
          border: '1px solid #3a3f5c',
          boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 24px -4px rgba(99, 102, 241, 0.15)',
            borderColor: '#6366f1',
            borderWidth: '2px',
          },
          '&:hover': {
            borderColor: '#6366f1',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.12)',
          },
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          color: '#ffffff',
          borderRadius: '0.75rem 0.75rem 0 0',
          minHeight: '64px',
          '&.Mui-expanded': {
            minHeight: '64px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
          },
          '&:hover': {
            background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
          },
          '& .MuiAccordionSummary-content': {
            margin: '12px 0',
            alignItems: 'center',
          },
          '& .MuiAccordionSummary-expandIconWrapper': {
            color: '#ffffff',
            opacity: 0.8,
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            '&.Mui-expanded': {
              transform: 'rotate(180deg)',
            },
            '&:hover': {
              opacity: 1,
            },
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: '24px',
          backgroundColor: '#1a1d29',
          fontSize: '0.9rem',
          lineHeight: 1.6,
          borderRadius: '0 0 0.75rem 0.75rem',
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