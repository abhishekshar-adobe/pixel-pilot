import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Avatar,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  AlertTitle,
  IconButton,
  Paper,
  Tooltip
} from '@mui/material'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Dashboard as DashboardIcon,
  CheckCircle,
  Error,
  Timer,
  TrendingUp,
  PhotoLibrary,
  Compare,
  TimerOutlined,
  BugReport,
  AccessTime,
  Speed,
  AutoAwesome
} from '@mui/icons-material'

const API_BASE = 'http://localhost:5000/api'

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState({
    totalScenarios: 0,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    averageTestTime: 0,
    recentTests: [],
    browserStats: {},
    viewportStats: {},
    lastTestRun: null,
    topFailingScenarios: [],
    testHistory: [],
    passRate: 0
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [scenariosRes, resultsRes] = await Promise.all([
        axios.get(`${API_BASE}/scenarios`),
        axios.get(`${API_BASE}/test-results`)
      ])

      const scenarios = scenariosRes.data.scenarios || scenariosRes.data || []
      const testResults = resultsRes.data || {}

      // Process test results
      const processedData = processTestResults(scenarios, testResults)
      setDashboardData(processedData)
      setError(null)
    } catch (err) {
      setError('Error loading dashboard data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const processTestResults = (scenarios, testResults) => {
    const tests = testResults.tests || []
    const passedTests = tests.filter(test => test.status === 'pass').length
    const failedTests = tests.filter(test => test.status === 'fail').length

    // Get top failing scenarios
    const failureCount = {}
    tests.forEach(test => {
      if (test.status === 'fail') {
        failureCount[test.pair.label] = (failureCount[test.pair.label] || 0) + 1
      }
    })

    const topFailingScenarios = Object.entries(failureCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }))

    // Mock test history for the last 6 days
    const testHistory = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (5 - index))
      const successRate = Math.floor(Math.random() * (95 - 85 + 1) + 85)
      return {
        date: date.toISOString().split('T')[0],
        rate: successRate
      }
    })

    // Add today's data
    testHistory.push({
      date: new Date().toISOString().split('T')[0],
      rate: tests.length ? ((passedTests / tests.length) * 100).toFixed(1) : 0
    })

    return {
      totalScenarios: scenarios.length,
      totalTests: tests.length,
      passedTests,
      failedTests,
      passRate: tests.length ? ((passedTests / tests.length) * 100).toFixed(1) : 0,
      topFailingScenarios,
      lastTestRun: testResults.testTimestamp || null,
      averageTestTime: testResults.averageTestTime || 0,
      testHistory
    }
  }

  if (loading) {
    return (
      <Box sx={{ width: '100%', p: 3 }}>
        <LinearProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ width: '100%', p: 3 }}>
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Section */}
      <Box sx={{ 
        width: '100%', 
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid',
        borderColor: 'divider',
        mb: 3
      }}>
        <Box sx={{ 
          maxWidth: '100%', 
          px: { xs: 2, sm: 3 }, 
          py: 3,
          margin: '0 auto'
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
              <DashboardIcon />
            </Avatar>
            <Box>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Dashboard
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
                Visual Testing Overview and Analytics
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
      
      {/* Content Container */}
      <Box sx={{ 
        maxWidth: '100%', 
        px: { xs: 2, sm: 3 }, 
        margin: '0 auto'
      }}>
        {/* Main Stats Grid */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Total Scenarios */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PhotoLibrary />
                    <Typography variant="h6">Total Scenarios</Typography>
                  </Stack>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    {dashboardData.totalScenarios}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Active test scenarios
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Pass Rate */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
              color: 'white'
            }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CheckCircle />
                    <Typography variant="h6">Pass Rate</Typography>
                  </Stack>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    {dashboardData.passRate}%
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    {dashboardData.passedTests} passed of {dashboardData.totalTests} tests
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Failed Tests */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
              color: 'white'
            }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Error />
                    <Typography variant="h6">Failed Tests</Typography>
                  </Stack>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    {dashboardData.failedTests}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Tests requiring attention
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Average Test Time */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              color: '#8B4513'
            }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Timer />
                    <Typography variant="h6">Avg. Test Time</Typography>
                  </Stack>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    {(dashboardData.averageTestTime / 1000).toFixed(1)}s
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Per scenario average
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts Section */}
        <Grid 
          container 
          spacing={{ xs: 2, sm: 3 }} 
          sx={{ 
            mb: 4,
            mx: 0,
            width: '100%'
          }}
        >
          {/* Test Success Rate Trend */}
          <Grid item xs={12} md={4} sx={{ px: { xs: 0, sm: 1 } }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">
                    Test Success Rate Trend
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={dashboardData.testHistory}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="rate"
                          name="Success Rate (%)"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Test Distribution */}
          <Grid item xs={12} md={4} sx={{ px: { xs: 0, sm: 1 } }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">
                    Test Distribution
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Passed', value: dashboardData.passedTests },
                            { name: 'Failed', value: dashboardData.failedTests }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                        >
                          <Cell fill="#4caf50" />
                          <Cell fill="#f44336" />
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Failing Scenarios Analysis */}
          <Grid item xs={12} md={4} sx={{ px: { xs: 0, sm: 1 } }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">
                    Top Failing Scenarios Analysis
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashboardData.topFailingScenarios}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar
                          dataKey="count"
                          name="Failure Count"
                          fill="#ff9a9e"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Activity Section */}
        <Grid 
          container 
          spacing={{ xs: 2, sm: 3 }} 
          sx={{ 
            mb: 4,
            mx: 0,
            width: '100%'
          }}
        >
          {/* Recent Activity */}
          <Grid item xs={12} md={6} sx={{ px: { xs: 0, sm: 1 } }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AccessTime color="primary" />
                    <Typography variant="h6">Recent Activity</Typography>
                  </Stack>
                  <Divider />
                  <Stack spacing={2}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <Speed />
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="subtitle1">Last Test Run</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {dashboardData.lastTestRun ? new Date(dashboardData.lastTestRun).toLocaleString() : 'No recent tests'}
                          </Typography>
                        </Box>
                        <Chip 
                          icon={<AutoAwesome />} 
                          label={dashboardData.passRate + '% Pass Rate'} 
                          color={dashboardData.passRate > 90 ? 'success' : dashboardData.passRate > 75 ? 'warning' : 'error'}
                        />
                      </Stack>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1">Test Summary</Typography>
                        <Stack direction="row" spacing={2}>
                          <Chip 
                            icon={<CheckCircle />} 
                            label={`${dashboardData.passedTests} Passed`} 
                            color="success"
                            variant="outlined"
                          />
                          <Chip 
                            icon={<Error />} 
                            label={`${dashboardData.failedTests} Failed`} 
                            color="error"
                            variant="outlined"
                          />
                          <Chip 
                            icon={<Compare />} 
                            label={`${dashboardData.totalTests} Total`} 
                            color="primary"
                            variant="outlined"
                          />
                        </Stack>
                      </Stack>
                    </Paper>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Failing Scenarios List */}
          <Grid item xs={12} md={6} sx={{ px: { xs: 0, sm: 1 } }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <BugReport color="error" />
                    <Typography variant="h6">Top Failing Scenarios</Typography>
                  </Stack>
                  <Divider />
                  <List>
                    {dashboardData.topFailingScenarios.map((scenario, index) => (
                      <ListItem key={index} divider={index !== dashboardData.topFailingScenarios.length - 1}>
                        <ListItemText
                          primary={scenario.label}
                          secondary={`Failed ${scenario.count} ${scenario.count === 1 ? 'time' : 'times'}`}
                        />
                        <Chip 
                          label={`${scenario.count} failures`}
                          color="error"
                          size="small"
                          variant="outlined"
                        />
                      </ListItem>
                    ))}
                    {dashboardData.topFailingScenarios.length === 0 && (
                      <ListItem>
                        <ListItemText
                          primary="No failing scenarios"
                          secondary="All tests are passing"
                        />
                        <CheckCircle color="success" />
                      </ListItem>
                    )}
                  </List>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}

export default Dashboard
