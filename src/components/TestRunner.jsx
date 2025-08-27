import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  Checkbox,
  Chip,
  Alert,
  AlertTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Grid,
  Paper,
  Divider,
  Avatar,
  Badge,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress,
  Fade,
  Collapse
} from '@mui/material'
import {
  PlayArrow,
  CheckCircleOutline,
  ExpandMore,
  SelectAll,
  Clear,
  CheckCircle,
  RocketLaunch,
  Science,
  Visibility,
  Timeline,
  BugReport,
  Speed,
  AutoFixHigh,
  Assessment,
  TrendingUp,
  CheckCircleRounded,
  RadioButtonUnchecked,
  Settings,
  Refresh,
  InfoOutlined,
  WarningAmber
} from '@mui/icons-material'

const API_BASE = 'http://localhost:5000/api'

// Helper function to render status chip
const getStatusChip = (status, misMatchPercentage) => {
  const statusConfig = {
    pending: { color: 'default', icon: <RadioButtonUnchecked />, label: 'Not Run' },
    running: { color: 'primary', icon: <CircularProgress size={16} />, label: 'Running...' },
    passed: { color: 'success', icon: <CheckCircle />, label: 'Passed' },
    failed: { color: 'error', icon: <Clear />, label: `Failed (${misMatchPercentage}% diff)` }
  };

  const config = statusConfig[status];
  return config ? (
    <Chip
      size="small"
      icon={config.icon}
      label={config.label}
      color={config.color}
      variant="outlined"
      sx={{ ml: 1 }}
    />
  ) : null;
};

function TestRunner({ project, config }) {
  const [testRunning, setTestRunning] = useState(false)
  const [approveRunning, setApproveRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [selectedScenarios, setSelectedScenarios] = useState([])
  const [runAllScenarios, setRunAllScenarios] = useState(true)
  const [activeStep, setActiveStep] = useState(0)
  const [expandedResult, setExpandedResult] = useState(false)
  const [scenarioResults, setScenarioResults] = useState({}) // Track test results per scenario
  const [currentScenario, setCurrentScenario] = useState(null) // Currently running scenario
  const [backstopReport, setBackstopReport] = useState(null)

  useEffect(() => {
    const init = async () => {
      await loadScenarios();
      await loadBackstopReport();
      // Set all scenarios as selected when runAllScenarios is true
      if (runAllScenarios && scenarios.length > 0) {
        setSelectedScenarios(scenarios.map(s => s.label));
      }
    };
    init();
  }, []);

  const loadBackstopReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/test-results`);
      if (response.data && !response.data.error) {
        setBackstopReport(response.data);
        // Update scenario results from BackstopJS report
        if (response.data?.tests) {
          const results = {};
          response.data.tests.forEach(test => {
            results[test.pair.label] = {
              status: test.status === 'pass' ? 'passed' : 'failed',
              misMatchPercentage: test.misMatchPercentage,
              isSameDimensions: test.isSameDimensions,
              diff: test.pair.diffImage,
              test: test.pair.test,
              reference: test.pair.reference
            };
          });
          setScenarioResults(results);
        }
      } else {
        setBackstopReport(null);
        // Show a friendly message and enable test button
        setMessage('No test results found for this project. Click "Run Visual Regression Test" to generate your first results.');
      }
    } catch (error) {
      setBackstopReport(null);
      setMessage('No test results found for this project. Click "Run Visual Regression Test" to generate your first results.');
    }
  };

  const loadScenarios = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/scenarios`);
      const loadedScenarios = response.data.scenarios || response.data || [];
      setScenarios(loadedScenarios);
      // Set all scenarios as selected if in "Run All" mode
      if (runAllScenarios) {
        setSelectedScenarios(loadedScenarios.map(s => s.label));
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  };

  const runApprove = async () => {
    setApproveRunning(true)
    setMessage('')
    setTestResult(null)
    
    try {
      const filter = runAllScenarios ? undefined : selectedScenarios.join('|')
      const response = await axios.post(`${API_BASE}/approve`, { filter })
      setMessage('✅ Test images approved as new references! All failing tests are now passing.')
      setTestResult(response.data)
    } catch (error) {
      setMessage(`Error approving tests: ${error.response?.data?.error || error.message}`)
    } finally {
      setApproveRunning(false)
    }
  }

  const runTest = async () => {
    setTestRunning(true);
    setMessage("");
    setTestResult(null);

    // Initialize results for all scenarios as pending
    const scenariosToTest = runAllScenarios ? scenarios : scenarios.filter(s => selectedScenarios.includes(s.label));
    const initialResults = {};
    scenariosToTest.forEach(s => {
      initialResults[s.label] = { status: "pending" };
    });
    setScenarioResults(initialResults);

    try {
      const filter = runAllScenarios ? undefined : selectedScenarios.join("|");
      // Actually trigger the backend test API
      const response = await axios.post(`${API_BASE}/projects/${project.id}/test`, { filter });
      setMessage("Test started. Please wait for results...");
      // After running, fetch test results
      await loadBackstopReport();
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.reportPath) {
        setMessage(`Test completed with differences detected.`);
        setTestResult(errorData);
        await loadBackstopReport();
      } else {
        setMessage(`Error running test: ${errorData?.error || error.message}`);
      }
    } finally {
      setTestRunning(false);
      setCurrentScenario(null);
    }
  };

  const handleScenarioSelection = (scenarioLabel) => {
    if (selectedScenarios.includes(scenarioLabel)) {
      setSelectedScenarios(selectedScenarios.filter(s => s !== scenarioLabel));
    } else {
      setSelectedScenarios([...selectedScenarios, scenarioLabel]);
    }
  };
  return (
    <Box sx={{ mb: 4, px: 3 }}>
      {/* Header Section */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
          <RocketLaunch />
        </Avatar>
        <Box>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Test Runner
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
            Execute visual regression tests and manage reference baselines
          </Typography>
        </Box>
      </Stack>

      {/* Message Alert */}
      {message && (
        <Fade in={Boolean(message)}>
          <Alert 
            severity={message.includes('Error') ? 'error' : 'info'}
            sx={{ mb: 3, borderRadius: 2 }}
            action={
              <IconButton color="inherit" size="small" onClick={() => setMessage('')}>
                <Clear />
              </IconButton>
            }
          >
            {message}
          </Alert>
        </Fade>
      )}

      {/* Test Execution Panel */}
      <Card sx={{ mt: 2, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Button
              variant="contained"
              size="large"
              startIcon={testRunning ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
              onClick={runTest}
              disabled={testRunning || approveRunning || scenarios.length === 0 || (!runAllScenarios && selectedScenarios.length === 0)}
              fullWidth
              sx={{ py: 2, borderRadius: 3, fontSize: '1.1rem', fontWeight: 600 }}
            >
              {testRunning ? 'Running Visual Tests...' : 'Run Visual Regression Test'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
      {/* Scenario Selection UI */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Select Scenarios to Test
        </Typography>
        {scenarios.length > 0 ? (
          <Stack spacing={1}>
            {scenarios.map((scenario) => (
              <Paper
                key={scenario.label || scenario.url}
                sx={{ p: 2, border: '1px solid', borderColor: selectedScenarios.includes(scenario.label) ? 'primary.main' : 'divider', borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main', boxShadow: 1 } }}
                onClick={() => handleScenarioSelection(scenario.label)}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  {selectedScenarios.includes(scenario.label) ? (
                    <CheckCircleRounded color="primary" />
                  ) : (
                    <RadioButtonUnchecked color="disabled" />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" fontWeight={500}>
                      {scenario.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {scenario.url}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
            <AlertTitle>No Scenarios Found</AlertTitle>
            Please configure scenarios in the Scenario Manager first.
          </Alert>
        )}
      </Box>
    </Box>
  );
}

export default TestRunner
