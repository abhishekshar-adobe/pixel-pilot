import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, AppBar, Toolbar, Typography, Tabs, Tab, Box } from '@mui/material'
import { SettingsOutlined, PlayArrowOutlined, UploadFileOutlined, CompareArrowsOutlined, CodeOutlined, ViewListOutlined } from '@mui/icons-material'
import ConfigEditor from './components/ConfigEditor'
import ScenarioManager from './components/ScenarioManager'
import ScreenshotUploader from './components/ScreenshotUploader'
import TestRunner from './components/TestRunner'
import DesignComparison from './components/DesignComparison'
import FigmaHTMLGenerator from './components/FigmaHTMLGenerator'
import Footer from './components/Footer'
import pixelPilotTheme from './theme/theme'
import pixelPilotLogo from './assets/pixelpilot-logo.svg'

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const getActiveTab = () => {
    switch (location.pathname) {
      case '/': return 0
      case '/scenarios': return 1
      case '/upload': return 2
      case '/test': return 3
      case '/design-comparison': return 4
      case '/figma-generator': return 5
      default: return 0
    }
  }

  const handleTabChange = (event, newValue) => {
    const routes = ['/', '/scenarios', '/upload', '/test', '/design-comparison', '/figma-generator']
    navigate(routes[newValue])
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <AppBar position="static" elevation={0} sx={{ 
        backgroundColor: '#ffffff', 
        borderBottom: 1, 
        borderColor: '#e5e7eb'
      }}>
        <Box sx={{ width: '100%', px: 2 }}>
          <Toolbar sx={{ px: 0, minHeight: 64 }}>
            <img 
              src={pixelPilotLogo} 
              alt="PixelPilot Logo" 
              style={{ 
                width: 40, 
                height: 40, 
                marginRight: 16 
              }} 
            />
            <Typography 
              variant="h5" 
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
            sx={{ 
              borderBottom: 1, 
              borderColor: '#e5e7eb',
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                minHeight: 48,
                borderRadius: 0,
                '&.Mui-selected': {
                  color: '#2563eb',
                  fontWeight: 600
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#2563eb',
                height: 2
              }
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<SettingsOutlined />} 
              label="Configuration" 
              iconPosition="start"
            />
            <Tab 
              icon={<ViewListOutlined />} 
              label="Scenarios" 
              iconPosition="start"
            />
            <Tab 
              icon={<UploadFileOutlined />} 
              label="Upload Screenshots" 
              iconPosition="start"
            />
            <Tab 
              icon={<PlayArrowOutlined />} 
              label="Run Tests" 
              iconPosition="start"
            />
            <Tab 
              icon={<CompareArrowsOutlined />} 
              label="Design Comparison" 
              iconPosition="start"
            />
            <Tab 
              icon={<CodeOutlined />} 
              label="Figma Generator" 
              iconPosition="start"
            />
          </Tabs>
        </Box>
      </AppBar>

      <Box sx={{ 
        flex: 1, 
        width: '100%'
      }}>
        <Routes>
          <Route path="/" element={<ConfigEditor />} />
          <Route path="/scenarios" element={<ScenarioManager />} />
          <Route path="/upload" element={<ScreenshotUploader />} />
          <Route path="/test" element={<TestRunner />} />
          <Route path="/design-comparison" element={<DesignComparison />} />
          <Route path="/figma-generator" element={<FigmaHTMLGenerator />} />
        </Routes>
      </Box>

      <Footer />
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
