import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as BugReportIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Code as CodeIcon,
  Palette as PaletteIcon
} from '@mui/icons-material';

const CSSIssueAnalyzer = () => {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeCSS = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/analyze-css-issues');
      const data = await response.json();
      
      if (data.success) {
        setAnalysisData(data);
      } else {
        setError(data.error || 'Failed to analyze CSS issues');
      }
    } catch (err) {
      setError('Failed to connect to server: ' + err.message);
    }
    setLoading(false);
  }, []);

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return <BugReportIcon color="error" />;
      case 'medium':
        return <WarningIcon color="warning" />;
      case 'low':
        return <InfoIcon color="info" />;
      default:
        return <CheckCircleIcon color="success" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'success';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🔍 CSS Issue Analyzer
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Analyze BackstopJS test reports to identify potential CSS issues and get actionable suggestions for fixes.
      </Typography>

      <Button
        variant="contained"
        onClick={analyzeCSS}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : <AnalyticsIcon />}
        sx={{ mb: 3 }}
      >
        {loading ? 'Analyzing...' : 'Analyze CSS Issues'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {analysisData && (
        <Grid container spacing={3}>
          {/* Summary Cards */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📊 Test Summary
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Total Tests:</Typography>
                    <Chip label={analysisData.totalTests} color="primary" size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Failed Tests:</Typography>
                    <Chip 
                      label={analysisData.failedTests} 
                      color={analysisData.failedTests > 0 ? "error" : "success"} 
                      size="small" 
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Scenarios with Issues:</Typography>
                    <Chip label={analysisData.cssIssues.length} color="warning" size="small" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🎯 Issue Distribution
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {['high', 'medium', 'low', 'info'].map(severity => {
                    const count = analysisData.cssIssues.reduce((acc, scenario) => 
                      acc + scenario.issues.filter(issue => issue.severity === severity).length, 0
                    );
                    return count > 0 && (
                      <Chip
                        key={severity}
                        icon={getSeverityIcon(severity)}
                        label={`${severity.toUpperCase()}: ${count}`}
                        color={getSeverityColor(severity)}
                        variant="outlined"
                      />
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Detailed Issues */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              🔧 Detailed Analysis
            </Typography>
            
            {analysisData.cssIssues.length === 0 ? (
              <Alert severity="success">
                <Typography>🎉 No CSS issues detected! All tests passed successfully.</Typography>
              </Alert>
            ) : (
              analysisData.cssIssues.map((scenario, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        {scenario.scenario} - {scenario.viewport}
                      </Typography>
                      <Chip 
                        label={`${scenario.diffPercentage}% diff`}
                        color={scenario.diffPercentage > 20 ? 'error' : scenario.diffPercentage > 5 ? 'warning' : 'info'}
                      />
                    </Box>

                    {scenario.issues.map((issue, issueIndex) => (
                      <Accordion key={issueIndex}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            {getSeverityIcon(issue.severity)}
                            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                              {issue.category}
                            </Typography>
                            <Chip 
                              label={issue.severity.toUpperCase()}
                              color={getSeverityColor(issue.severity)}
                              size="small"
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {issue.description}
                              </Typography>
                            </Grid>

                            {/* Measurements Section */}
                            {issue.measurements && (
                              <Grid item xs={12}>
                                <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText', mb: 2 }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    📏 Precise Measurements:
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {Object.entries(issue.measurements).map(([key, value], idx) => (
                                      <Chip 
                                        key={idx}
                                        label={`${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${value}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ 
                                          bgcolor: 'rgba(255,255,255,0.2)', 
                                          color: 'inherit',
                                          fontFamily: 'monospace',
                                          fontSize: '0.75rem'
                                        }}
                                      />
                                    ))}
                                  </Box>
                                </Paper>
                              </Grid>
                            )}
                            
                            <Grid item xs={12} md={6}>
                              <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  🔍 Possible Causes:
                                </Typography>
                                <List dense>
                                  {issue.possibleCauses.map((cause, causeIndex) => (
                                    <ListItem key={causeIndex} sx={{ py: 0.5 }}>
                                      <ListItemIcon sx={{ minWidth: 20 }}>
                                        <Typography variant="body2">•</Typography>
                                      </ListItemIcon>
                                      <ListItemText 
                                        primary={cause}
                                        primaryTypographyProps={{ 
                                          variant: 'body2',
                                          sx: { fontFamily: cause.includes('px') ? 'monospace' : 'inherit' }
                                        }}
                                      />
                                    </ListItem>
                                  ))}
                                </List>
                              </Paper>
                            </Grid>
                            
                            <Grid item xs={12} md={6}>
                              <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  🛠️ Suggested Fixes:
                                </Typography>
                                <List dense>
                                  {issue.suggestedFixes.map((fix, fixIndex) => (
                                    <ListItem key={fixIndex} sx={{ py: 0.5 }}>
                                      <ListItemIcon sx={{ minWidth: 20 }}>
                                        <Typography variant="body2">✓</Typography>
                                      </ListItemIcon>
                                      <ListItemText 
                                        primary={fix}
                                        primaryTypographyProps={{ 
                                          variant: 'body2',
                                          sx: { fontFamily: fix.includes('px') ? 'monospace' : 'inherit' }
                                        }}
                                      />
                                    </ListItem>
                                  ))}
                                </List>
                              </Paper>
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </Grid>
        </Grid>
      )}

      {analysisData && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Report generated: {new Date(analysisData.reportGenerated).toLocaleString()}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CSSIssueAnalyzer;
