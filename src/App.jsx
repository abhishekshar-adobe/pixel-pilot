import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, Container, AppBar, Toolbar, Typography, Tabs, Tab, Box } from '@mui/material'
import { PhotoCameraOutlined, SettingsOutlined, PlayArrowOutlined, UploadFileOutlined, BugReportOutlined } from '@mui/icons-material'
import ConfigEditor from './components/ConfigEditor'
import ScenarioManager from './components/ScenarioManager'
import ScreenshotUploader from './components/ScreenshotUploader'
import TestRunner from './components/TestRunner'
import CSSIssueAnalyzer from './components/CSSIssueAnalyzer'
import pixelPilotTheme from './theme/theme'

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const getActiveTab = () => {
    switch (location.pathname) {
      case '/': return 0
      case '/scenarios': return 1
      case '/upload': return 2
      case '/test': return 3
      case '/analyze': return 4
      default: return 0
    }
  }

  const handleTabChange = (event, newValue) => {
    const routes = ['/', '/scenarios', '/upload', '/test', '/analyze']
    navigate(routes[newValue])
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" elevation={0} sx={{ 
        backgroundColor: 'background.paper', 
        borderBottom: 1, 
        borderColor: 'divider',
        mb: 3
      }}>
        <Container maxWidth="xl">
          <Toolbar sx={{ px: 0 }}>
            <PhotoCameraOutlined sx={{ mr: 2, color: 'primary.main' }} />
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                flexGrow: 1, 
                color: 'text.primary',
                fontWeight: 700
              }}
            >
              PixelPilot
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                fontWeight: 500
              }}
            >
              BackstopJS Dashboard
            </Typography>
          </Toolbar>
          
          <Tabs 
            value={getActiveTab()} 
            onChange={handleTabChange}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<SettingsOutlined />} 
              label="Configuration" 
              iconPosition="start"
              sx={{ textTransform: 'none', fontWeight: 500, minHeight: 64 }}
            />
            <Tab 
              icon={<PhotoCameraOutlined />} 
              label="Scenarios" 
              iconPosition="start"
              sx={{ textTransform: 'none', fontWeight: 500, minHeight: 64 }}
            />
            <Tab 
              icon={<UploadFileOutlined />} 
              label="Upload Screenshots" 
              iconPosition="start"
              sx={{ textTransform: 'none', fontWeight: 500, minHeight: 64 }}
            />
            <Tab 
              icon={<PlayArrowOutlined />} 
              label="Run Tests" 
              iconPosition="start"
              sx={{ textTransform: 'none', fontWeight: 500, minHeight: 64 }}
            />
            <Tab 
              icon={<BugReportOutlined />} 
              label="CSS Issues" 
              iconPosition="start"
              sx={{ textTransform: 'none', fontWeight: 500, minHeight: 64 }}
            />
          </Tabs>
        </Container>
      </AppBar>

      <Container maxWidth="xl" sx={{ px: 3 }}>
        <Routes>
          <Route path="/" element={<ConfigEditor />} />
          <Route path="/scenarios" element={<ScenarioManager />} />
          <Route path="/upload" element={<ScreenshotUploader />} />
          <Route path="/test" element={<TestRunner />} />
          <Route path="/analyze" element={<CSSIssueAnalyzer />} />
        </Routes>
      </Container>
    </Box>
  )
}

function App() {
  return (
    <ThemeProvider theme={pixelPilotTheme}>
      <CssBaseline />
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  )
}

export default App
