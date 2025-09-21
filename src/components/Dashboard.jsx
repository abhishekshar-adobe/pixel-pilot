import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Divider,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemButton
} from '@mui/material';
import {
  SettingsOutlined,
  ViewListOutlined,
  ImageOutlined,
  CheckCircleOutlined,
  ErrorOutlined,
  InfoOutlined,
  DashboardOutlined,
  Delete,
  GetApp,
  Visibility
} from '@mui/icons-material';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, Rectangle } from 'recharts';
import axios from 'axios';
import pixelPilotLogo from '../assets/pixelpilot-logo.svg';

const API_BASE = 'http://localhost:5000/api';

const Dashboard = ({ project, config }) => {
  // Test summary state
  const [testSummary, setTestSummary] = useState(null);
  const [testSummaryLoading, setTestSummaryLoading] = useState(true);
  const [testSummaryError, setTestSummaryError] = useState('');

  // Combined batch summary state
  const [combinedSummary, setCombinedSummary] = useState(null);
  const [batchData, setBatchData] = useState(null);

  // Delete batch run state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState(null);

  useEffect(() => {
    if (project?.id) {
      fetchTestSummary();
      fetchCombinedSummary();
    }
  }, [project]);

  const fetchTestSummary = async () => {
    setTestSummaryLoading(true);
    setTestSummaryError('');
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/test-results`);
      const results = Array.isArray(response.data.results)
        ? response.data.results
        : Array.isArray(response.data.tests)
          ? response.data.tests
          : Array.isArray(response.data)
            ? response.data
            : [];
      
      // Summarize status counts - simplified to 3 categories
      const passedTests = results.filter(r => r.status === 'pass');
      const networkErrorTests = results.filter(r => r.status === 'fail' && r.networkError);
      const failedTests = results.filter(r => r.status === 'fail' && !r.networkError);
      
      const summary = {
        total: results.length,
        passed: passedTests.length,
        failed: failedTests.length,
        networkError: networkErrorTests.length,
        // Enhanced data from server
        hasNetworkErrors: response.data.hasNetworkErrors || networkErrorTests.length > 0,
        networkErrorCount: response.data.networkErrorCount || networkErrorTests.length
      };
      setTestSummary({ summary, results });
    } catch (err) {
      setTestSummaryError('Failed to load test summary');
    } finally {
      setTestSummaryLoading(false);
    }
  };

  const fetchCombinedSummary = async () => {
    try {
      console.log('Fetching combined summary for project:', project.id); // Debug log
      const response = await axios.get(`${API_BASE}/projects/${project.id}/batches`);
      console.log('Batch data response:', response.data); // Debug log
      setBatchData(response.data);
      
      if (response.data.runs && response.data.runs.length > 0) {
        const latestRun = response.data.runs[0];
        console.log('Latest run:', latestRun); // Debug log
        console.log('Has combined report:', latestRun.hasCombinedReport); // Debug log
        console.log('Combined report info:', latestRun.combinedReportInfo); // Debug log
        
        // Check if we have valid combined report data with actual test results
        if (latestRun.hasCombinedReport && 
            latestRun.combinedReportInfo && 
            (latestRun.combinedReportInfo.total > 0 || 
             latestRun.combinedReportInfo.passed > 0 || 
             latestRun.combinedReportInfo.failed > 0)) {
          
          setCombinedSummary({
            total: latestRun.combinedReportInfo.total || 0,
            passed: latestRun.combinedReportInfo.passed || 0,
            failed: latestRun.combinedReportInfo.failed || 0,
            totalScenarios: latestRun.combinedReportInfo.totalScenarios || 0,
            runId: latestRun.runId,
            timestamp: latestRun.meta?.timestamp,
            url: latestRun.combinedReportInfo.url
          });
          console.log('Setting combined summary with valid data'); // Debug log
        } else {
          // Clear combined summary if no valid combined report data is available
          console.log('No valid combined report data, clearing summary'); // Debug log
          setCombinedSummary(null);
        }
      } else {
        // Clear combined summary if no runs are available
        console.log('No runs available, clearing summary'); // Debug log
        setCombinedSummary(null);
      }
    } catch (error) {
      console.error('Error fetching combined summary:', error);
      setCombinedSummary(null);
    }
  };

  // Batch run action handlers
  const handleDeleteBatchRun = (run) => {
    console.log('Setting batch to delete:', run);
    console.log('Run ID:', run.runId);
    setBatchToDelete(run);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteBatchRun = async () => {
    if (batchToDelete) {
      try {
        console.log('Deleting batch run:', batchToDelete.runId);
        const deleteUrl = `${API_BASE}/projects/${project.id}/batches/${batchToDelete.runId}`;
        console.log('DELETE URL:', deleteUrl);
        
        const response = await axios.delete(deleteUrl);
        console.log('Delete response:', response.data);
        
        setDeleteDialogOpen(false);
        setBatchToDelete(null);
        fetchCombinedSummary(); // Refresh the batch data
        alert('Batch run deleted successfully');
      } catch (error) {
        console.error('Failed to delete batch run:', error);
        console.error('Error details:', error.response?.data || error.message);
        alert(`Failed to delete batch run: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  const handleDownloadBatchCSV = async (run) => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/batches/${run.runId}/csv`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-run-${run.runId}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download batch CSV:', error);
      alert('Failed to download batch CSV');
    }
  };

  // Format custom timestamp (YYYYMMDDHHMMSS.) to readable date
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle the custom format like "20250919135208."
      const cleanTimestamp = timestamp.toString().replace('.', '');
      
      if (cleanTimestamp.length >= 14) {
        const year = cleanTimestamp.substring(0, 4);
        const month = cleanTimestamp.substring(4, 6);
        const day = cleanTimestamp.substring(6, 8);
        const hours = cleanTimestamp.substring(8, 10);
        const minutes = cleanTimestamp.substring(10, 12);
        const seconds = cleanTimestamp.substring(12, 14);
        
        const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
        
        if (isNaN(date.getTime())) {
          return 'Invalid Date';
        }
        
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
      
      // Fallback: try to parse as-is
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleString();
    } catch (error) {
      console.error('Error formatting timestamp:', timestamp, error);
      return 'Invalid Date';
    }
  };

  const handleExportReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/projects/${project.id}/test-results`);
      const results = Array.isArray(response.data.results)
        ? response.data.results
        : Array.isArray(response.data.tests)
          ? response.data.tests
          : Array.isArray(response.data)
            ? response.data
            : [];
      if (results.length === 0) {
        alert('No test results found for this project.');
        return;
      }
      // Flatten results so each pair property and status is a column
      const flatResults = results.map(r => ({
        ...r.pair,
        ...(r.pair.diff || {}),
        status: r.status
      }));
      const csv = Papa.unparse(flatResults);
      // Trigger download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project_${project.id}_test_results.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export report.');
      console.error('Export error:', err);
    }
  };
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      loadScenarios();
    }
  }, [project]);

  const loadScenarios = async () => {
    try {
      setLoading(true);
      setError('');
  const response = await axios.get(`${API_BASE}/projects/${project.id}/scenarios`);
  setScenarios(response.data.scenarios || []);
    } catch (err) {
      console.error('Error loading scenarios:', err);
      setError('Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  };

  const getViewportCount = () => {
    if (!config?.viewports) return 0;
    return config.viewports.length;
  };

  if (loading) {
    return (
      <Box 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          width: '100%',
          bgcolor: 'background.default',
          borderRadius: '1rem',
          p: 3
        }}
      >
        <CircularProgress size={40} thickness={4} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: 'background.default',
      py: { xs: 3, md: 4 },
      px: { xs: 2, sm: 3, md: 4 }
    }}>
      {/* Project Info Header - top */}
      <Box
        sx={{
          mb: 4,
          p: { xs: 3, md: 4 },
          borderRadius: '1rem',
          bgcolor: 'background.paper',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2, 
              mb: 1 
            }}>
              <Box
                component="img"
                src={pixelPilotLogo}
                alt="PixelPilot Logo"
                sx={{
                  width: 40,
                  height: 40,
                  flexShrink: 0
                }}
              />
              <Typography 
                variant="h4" 
                sx={{
                  color: 'text.primary',
                  fontWeight: 700,
                  letterSpacing: '-0.025em'
                }}
              >
                Project Dashboard
              </Typography>
            </Box>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary'
              }}
            >
              Visual regression testing results and analytics
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              icon={<SettingsOutlined />}
              label={config ? `${config.scenarios?.length || 0} scenarios` : 'No config'}
              color={config ? 'primary' : 'warning'}
              variant="outlined"
              size="small"
            />
            {config && (
              <Chip
                icon={<ViewListOutlined />}
                label={`${config.viewports?.length || 0} viewports`}
                color="info"
                variant="outlined"
                size="small"
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Test Summary Section */}
      <Box
        sx={{
          mb: 4,
          p: { xs: 2, md: 3 },
          borderRadius: '1rem',
          bgcolor: 'background.paper',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        }}
      >
        <Typography
          variant="h5"
          sx={{
            mb: 3,
            fontWeight: 600,
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <DashboardOutlined sx={{ color: 'primary.main' }} />
          {combinedSummary ? 'Latest Batch Run Summary' : 'Test Summary'}
        </Typography>
        {testSummaryLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={30} />
          </Box>
        ) : testSummaryError ? (
          <Alert 
            severity="error"
            sx={{ 
              borderRadius: '0.75rem',
              '& .MuiAlert-icon': {
                fontSize: '24px'
              }
            }}
          >
            {testSummaryError}
          </Alert>
        ) : combinedSummary ? (
          <>
            <Box display="flex" gap={2} mb={2}>
              <Chip label={`Total: ${combinedSummary.total}`} color="info" />
              <Chip label={`Passed: ${combinedSummary.passed}`} color="success" />
              <Chip label={`Failed: ${combinedSummary.failed}`} color="error" />
              <Chip label={`Scenarios: ${combinedSummary.totalScenarios}`} color="primary" />
              <Button
                variant="contained"
                color="primary"
                onClick={() => window.open(combinedSummary.url, '_blank')}
                sx={{ ml: 'auto', borderRadius: 2 }}
              >
                View Combined Report
              </Button>
            </Box>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Run ID: {combinedSummary.runId} • {formatTimestamp(combinedSummary.timestamp)}
            </Typography>
            {/* Combined Report Pie Chart */}
            <Box mb={2}>
              <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Combined Batch Results Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[{
                      name: 'Pass', value: combinedSummary.passed
                    }, {
                      name: 'Fail', value: combinedSummary.failed
                    }]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    labelLine={false}
                    label={({ name, percent, value }) => 
                      value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''
                    }
                  >
                    <Cell key="pass" fill="#4caf50" />
                    <Cell key="fail" fill="#f44336" />
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value, name) => [value, name]}
                    labelFormatter={() => ''}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry) => `${value}: ${entry.payload.value}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            {/* Combined Results Bar Chart */}
            <Box mb={2}>
              <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Combined Results Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={[{
                    status: 'Passed', value: combinedSummary.passed, fill: '#4caf50'
                  }, {
                    status: 'Failed', value: combinedSummary.failed, fill: '#f44336'
                  }]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="status" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickLine={{ stroke: '#e0e0e0' }}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickLine={{ stroke: '#e0e0e0' }}
                  />
                  <RechartsTooltip 
                    formatter={(value) => [value, 'Tests']}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[4, 4, 0, 0]}
                    shape={(props) => {
                      const { ...rest } = props;
                      return <Rectangle {...rest} fill={props.payload.fill} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </>
        ) : testSummary ? (
          <>
            <Box display="flex" gap={2} mb={2}>
              <Chip label={`Total: ${testSummary.summary.total}`} color="info" />
              <Chip label={`Passed: ${testSummary.summary.passed}`} color="success" />
              <Chip label={`Failed: ${testSummary.summary.failed}`} color="error" />
              <Chip label={`Network Errors: ${testSummary.summary.networkError}`} color="warning" />
              <Button
                variant="contained"
                color="primary"
                onClick={handleExportReport}
                sx={{ ml: 'auto', borderRadius: 2 }}
              >
                Export Report
              </Button>
            </Box>
            {/* Pass/Fail/Network Error Pie Chart */}
            <Box mb={2}>
              <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Test Results Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[{
                      name: 'Pass', value: testSummary.summary.passed
                    }, {
                      name: 'Fail', value: testSummary.summary.failed
                    }, {
                      name: 'Network Error', value: testSummary.summary.networkError
                    }]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    labelLine={false}
                    label={({ name, percent, value }) => 
                      value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''
                    }
                  >
                    <Cell key="pass" fill="#4caf50" />
                    <Cell key="fail" fill="#f44336" />
                    <Cell key="networkError" fill="#ff9800" />
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value, name) => [value, name]}
                    labelFormatter={() => ''}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry) => `${value}: ${entry.payload.value}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            {/* Status Breakdown Graph */}
            <Box mb={2}>
              <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Test Results Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={[{
                    status: 'Passed', value: testSummary.summary.passed, fill: '#4caf50'
                  }, {
                    status: 'Failed', value: testSummary.summary.failed, fill: '#f44336'
                  }, {
                    status: 'Network Error', value: testSummary.summary.networkError, fill: '#ff9800'
                  }]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="status" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickLine={{ stroke: '#e0e0e0' }}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    tickLine={{ stroke: '#e0e0e0' }}
                  />
                  <RechartsTooltip 
                    formatter={(value) => [value, 'Tests']}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[4, 4, 0, 0]}
                    shape={(props) => {
                      const { ...rest } = props;
                      return <Rectangle {...rest} fill={props.payload.fill} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </>
        ) : null}
      </Box>

      {/* Batch Performance Comparison Chart */}
      {batchData && batchData.runs && batchData.runs.length > 0 && (
        <Box
          sx={{
            mb: 4,
            p: { xs: 2, md: 3 },
            borderRadius: '1rem',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Batch Performance Comparison
          </Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={batchData?.runs?.slice(0, 10).reverse().map(run => {
                  const chartData = {
                    runId: run.runId.split('_')[2]?.substring(0, 6) || run.runId.substring(-6),
                    timestamp: formatTimestamp(run.meta?.timestamp),
                    total: run.combinedReportInfo?.totalScenarios || 0,
                    passed: run.combinedReportInfo?.passed || 0,
                    failed: run.combinedReportInfo?.failed || 0
                  };
                  console.log('Chart data for run:', run.runId, chartData);
                  return chartData;
                })}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 80
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="runId" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <RechartsTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <Box sx={{ 
                          bgcolor: 'background.paper', 
                          border: '1px solid #ccc', 
                          borderRadius: 1, 
                          p: 1,
                          boxShadow: 2
                        }}>
                          <Typography variant="body2" fontWeight="bold">
                            Run: {label}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {data.timestamp}
                          </Typography>
                          <Typography variant="body2" color="success.main">
                            Passed: {data.passed}
                          </Typography>
                          <Typography variant="body2" color="error.main">
                            Failed: {data.failed}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            Total: {data.total}
                          </Typography>
                        </Box>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="passed" 
                  stackId="a"
                  fill="#4caf50" 
                  name="Passed"
                  shape={(props) => {
                    const { ...rest } = props;
                    return <Rectangle {...rest} fill="#4caf50" />;
                  }}
                />
                <Bar 
                  dataKey="failed" 
                  stackId="a"
                  fill="#f44336" 
                  name="Failed"
                  shape={(props) => {
                    const { ...rest } = props;
                    return <Rectangle {...rest} fill="#f44336" />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      )}

      {/* Recent Batch Runs Section */}
      {batchData && batchData.runs && batchData.runs.length > 0 && (
        <Box
          sx={{
            mb: 4,
            p: { xs: 2, md: 3 },
            borderRadius: '1rem',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          }}
        >
          <Typography
            variant="h5"
            sx={{
              mb: 3,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <ViewListOutlined sx={{ color: 'primary.main' }} />
            Recent Batch Runs
          </Typography>
          <TableContainer component={Paper} sx={{ borderRadius: '0.75rem' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Run ID</strong></TableCell>
                  <TableCell><strong>Timestamp</strong></TableCell>
                  <TableCell><strong>Total Tests</strong></TableCell>
                  <TableCell><strong>Passed</strong></TableCell>
                  <TableCell><strong>Failed</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batchData.runs.slice(0, 5).map((run) => (
                  <TableRow key={run.runId}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {run.runId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(run.meta?.timestamp)}
                    </TableCell>
                    <TableCell>
                      {run.combinedReportInfo?.total || run.batches?.length || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={run.combinedReportInfo?.passed || 0} 
                        color="success" 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={run.combinedReportInfo?.failed || 0} 
                        color="error" 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {run.hasCombinedReport && (
                          <Tooltip title="View Combined Report">
                            <IconButton
                              size="small"
                              onClick={() => window.open(run.combinedReportInfo.url, '_blank')}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Download CSV">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadBatchCSV(run)}
                          >
                            <GetApp />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Batch Run">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteBatchRun(run)}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Delete Batch Run Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Delete Batch Run
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete batch run "{batchToDelete?.runId}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This action cannot be undone. All test results, reports, and associated data will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDeleteBatchRun}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


export default Dashboard;
