import { Box, Container, Typography, Link, Grid, IconButton } from '@mui/material'
import { GitHub, LinkedIn, Email, PhotoCameraOutlined } from '@mui/icons-material'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 4,
        px: 2,
        backgroundColor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        marginTop: 4
      }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={4} alignItems="center">
          {/* Logo and Brand */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PhotoCameraOutlined sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                PixelPilot
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
              A comprehensive web-based dashboard for BackstopJS visual regression testing. 
              Streamline your visual testing workflow with intuitive configuration management and screenshot comparison.
            </Typography>
          </Grid>

          {/* Features */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
              Features
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="#" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                Configuration Editor
              </Link>
              <Link href="#" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                Scenario Management
              </Link>
              <Link href="#" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                Screenshot Upload
              </Link>
              <Link href="#" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                Test Runner
              </Link>
              <Link href="#" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                Design Comparison
              </Link>
            </Box>
          </Grid>

          {/* About */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
              Connect
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Built with React, Material-UI, and BackstopJS for reliable visual regression testing.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton 
                size="small" 
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                aria-label="GitHub"
              >
                <GitHub />
              </IconButton>
              <IconButton 
                size="small" 
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                aria-label="LinkedIn"
              >
                <LinkedIn />
              </IconButton>
              <IconButton 
                size="small" 
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                aria-label="Email"
              >
                <Email />
              </IconButton>
            </Box>
          </Grid>
        </Grid>

        {/* Bottom section */}
        <Box
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            pt: 3,
            mt: 3,
            textAlign: 'center'
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © {currentYear} PixelPilot. Built for efficient visual regression testing with BackstopJS.
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}