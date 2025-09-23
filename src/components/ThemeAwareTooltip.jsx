import { useTheme } from '@mui/material/styles';

// Custom theme-aware tooltip content style
export const useThemeAwareTooltipStyle = () => {
  const theme = useTheme();
  
  return {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '4px',
    color: theme.palette.text.primary,
    fontSize: '0.875rem',
    boxShadow: theme.shadows[4],
  };
};

export default useThemeAwareTooltipStyle;