import React, { useState } from 'react';
import { CssBaseline, Box } from '@mui/material';
import ProjectSelector from './components/ProjectSelector';
import ProjectDashboard from './components/ProjectDashboard';
import { PixelPilotThemeProvider } from './theme/ThemeContext.jsx';

function App() {
  const [selectedProject, setSelectedProject] = useState(() => {
    // Try to load from sessionStorage on first render
    const stored = sessionStorage.getItem('selectedProject');
    return stored ? JSON.parse(stored) : null;
  });

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    sessionStorage.setItem('selectedProject', JSON.stringify(project));
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    sessionStorage.removeItem('selectedProject');
  };

  return (
    <PixelPilotThemeProvider>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', width: '100%', bgcolor: 'background.default' }}>
        {selectedProject ? (
          <ProjectDashboard 
            project={selectedProject} 
            onBack={handleBackToProjects}
          />
        ) : (
          <ProjectSelector onProjectSelect={handleProjectSelect} />
        )}
      </Box>
    </PixelPilotThemeProvider>
  );
}

export default App;
