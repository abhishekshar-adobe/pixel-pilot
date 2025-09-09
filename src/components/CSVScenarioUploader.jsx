import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper
} from '@mui/material';
import { Upload, Check, Error, InfoOutlined } from '@mui/icons-material';
import Papa from 'papaparse';

const CSVScenarioUploader = ({ onScenariosCreated, loading: externalLoading = false }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsedScenarios, setParsedScenarios] = useState([]);

  // Use external loading state or internal loading state
  const isLoading = externalLoading || loading;

  const validateScenario = (scenario) => {
    const errors = [];
    if (!scenario.label) errors.push('Label is required');
    if (!scenario.url) errors.push('URL is required');
    if (!scenario.selectors) scenario.selectors = ['document'];
    
    // Convert string values to proper types
    scenario.delay = parseInt(scenario.delay) || 0;
    scenario.misMatchThreshold = parseFloat(scenario.misMatchThreshold) || 0.1;
    scenario.requireSameDimensions = scenario.requireSameDimensions === 'true';
    scenario.selectorExpansion = scenario.selectorExpansion !== 'false';
    
    // Convert comma-separated strings to arrays
    if (typeof scenario.selectors === 'string') {
      scenario.selectors = scenario.selectors.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof scenario.hideSelectors === 'string') {
      scenario.hideSelectors = scenario.hideSelectors.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof scenario.removeSelectors === 'string') {
      scenario.removeSelectors = scenario.removeSelectors.split(',').map(s => s.trim()).filter(Boolean);
    }

    return errors;
  };

  const handleFileUpload = (event) => {
    console.log('CSV Import: File upload initiated');
    setError('');
    const file = event.target.files[0];
    if (!file) {
      console.log('CSV Import: No file selected');
      return;
    }

    console.log('CSV Import: File selected', { name: file.name, type: file.type, size: file.size });

    if (file.type !== 'text/csv') {
      console.error('CSV Import: Invalid file type', file.type);
      setError('Please upload a CSV file');
      return;
    }

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transform: (value) => value.trim(),
      complete: (results) => {
        console.log('CSV Import: Parse complete', { data: results.data, errors: results.errors });
        
        if (results.errors.length > 0) {
          console.error('CSV Import: Parse errors', results.errors);
          setError('Error parsing CSV file: ' + results.errors[0].message);
          setLoading(false);
          return;
        }

        const scenarios = results.data.filter(row => row.label || row.url);
        console.log('CSV Import: Filtered scenarios', { count: scenarios.length, scenarios });
        
        const validScenarios = scenarios.map(scenario => {
          const validationErrors = validateScenario(scenario);
          return { ...scenario, validationErrors };
        });

        console.log('CSV Import: Validated scenarios', { count: validScenarios.length, validScenarios });
        
        setParsedScenarios(validScenarios);
        setPreviewOpen(true);
        setLoading(false);
      },
      error: (error) => {
        console.error('CSV Import: Parse error', error);
        setError('Error reading CSV file: ' + error.message);
        setLoading(false);
      }
    });
  };

  const handleConfirmUpload = async () => {
    console.log('CSV Import: handleConfirmUpload called', { parsedScenariosCount: parsedScenarios.length });
    
    // Use setTimeout to prevent blocking on large datasets
    setTimeout(async () => {
      const validScenarios = parsedScenarios
        .filter(scenario => scenario.validationErrors.length === 0);

      console.log('CSV Import: Valid scenarios to import', { count: validScenarios.length });

      if (validScenarios.length > 0) {
        console.log('CSV Import: Calling onScenariosCreated callback');
        
        // Call the callback without processing IDs here (let parent handle it)
        onScenariosCreated(validScenarios);
        
        // Reset local state after callback
        setPreviewOpen(false);
        setParsedScenarios([]);
        setError('');
      } else {
        console.warn('CSV Import: No valid scenarios to import');
      }
    }, 0);
  };

  return (
    <>
      <Card sx={{ 
          p: 3, 
          mb: 3, 
          border: '2px dashed', 
          borderColor: 'divider',
          width: '100%',
          maxWidth: 'none'
        }}>
        <Box display="flex" flexDirection="column" alignItems="center" sx={{ width: '100%' }}>
          <Upload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Import Scenarios from CSV
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
            Upload a CSV file to create multiple scenarios at once. Required fields: label, url
          </Typography>
          <Typography variant="caption" color="info.main" align="center" sx={{ display: 'block', mb: 1 }}>
            💡 For multiple selectors, use spaces instead of commas (e.g., ".header .nav .logo")
          </Typography>
          <Box sx={{ mb: 2, px: 2 }}>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ textAlign: 'left' }}>
              <strong>CSV Fields:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                <li>label, url (required)</li>
                <li>selectors (comma-separated, defaults to "document")</li>
                <li>delay (milliseconds, default: 0)</li>
                <li>misMatchThreshold (0-1, default: 0.1)</li>
                <li>requireSameDimensions (true/false)</li>
                <li>hideSelectors, removeSelectors (comma-separated)</li>
                <li>clickSelector, hoverSelector (single selector)</li>
                <li>selectorExpansion (true/false)</li>
                <li>customScript, customBeforeScript (JavaScript)</li>
                <li>compareUrl (optional alternate URL)</li>
              </ul>
            </Typography>
          </Box>
          <Button
            variant="outlined"
            component="label"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : <Upload />}
          >
            Choose CSV File
            <input
              type="file"
              hidden
              accept=".csv"
              onChange={handleFileUpload}
            />
          </Button>
          
          {error && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {error}
            </Alert>
          )}

          <Button
            sx={{ mt: 2 }}
            startIcon={<InfoOutlined />}
            onClick={() => window.open('/scenario-template.csv', '_blank')}
          >
            Download Template
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Template includes examples for all supported fields
          </Typography>
        </Box>
      </Card>

      <Dialog
        open={previewOpen && !externalLoading}
        onClose={() => {
          if (!externalLoading) {
            setPreviewOpen(false);
          }
        }}
        fullScreen
        sx={{
          '& .MuiDialog-paper': {
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          p: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                📊 CSV Scenarios Preview
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Review and validate {parsedScenarios.length} scenarios before importing
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                ✅ {parsedScenarios.filter(s => s.validationErrors.length === 0).length} Valid
              </Typography>
              <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                ❌ {parsedScenarios.filter(s => s.validationErrors.length > 0).length} Invalid
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <TableContainer 
              component={Paper} 
              sx={{ 
                flex: 1,
                m: 2,
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                overflow: 'auto'
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      minWidth: 60
                    }}>
                      S.No.
                    </TableCell>
                    <TableCell sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      minWidth: 80
                    }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      minWidth: 200
                    }}>
                      Scenario Label
                    </TableCell>
                    <TableCell sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      minWidth: 250
                    }}>
                      Target URL
                    </TableCell>
                    <TableCell sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      minWidth: 150
                    }}>
                      Selectors
                    </TableCell>
                    <TableCell sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      minWidth: 100
                    }}>
                      Delay
                    </TableCell>
                    <TableCell sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      minWidth: 120
                    }}>
                      Mismatch %
                    </TableCell>
                    <TableCell sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      minWidth: 120
                    }}>
                      Interactive
                    </TableCell>
                    <TableCell sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      minWidth: 200
                    }}>
                      Validation Status
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedScenarios.map((scenario, index) => (
                    <TableRow 
                      key={index}
                      sx={{ 
                        '&:nth-of-type(odd)': { 
                          backgroundColor: 'rgba(0,0,0,0.02)' 
                        },
                        '&:hover': {
                          backgroundColor: scenario.validationErrors.length === 0 
                            ? 'rgba(76, 175, 80, 0.08)' 
                            : 'rgba(244, 67, 54, 0.08)',
                          transform: 'scale(1.001)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        },
                        transition: 'all 0.2s ease',
                        borderLeft: scenario.validationErrors.length === 0 
                          ? '4px solid #4caf50' 
                          : '4px solid #f44336'
                      }}
                    >
                      <TableCell sx={{ 
                        fontWeight: 600, 
                        color: 'primary.main',
                        fontSize: '0.9rem'
                      }}>
                        #{index + 1}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {scenario.validationErrors.length === 0 ? (
                            <>
                              <Check sx={{ color: 'success.main', fontSize: 20 }} />
                              <Typography variant="caption" sx={{ 
                                color: 'success.main', 
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}>
                                VALID
                              </Typography>
                            </>
                          ) : (
                            <>
                              <Error sx={{ color: 'error.main', fontSize: 20 }} />
                              <Typography variant="caption" sx={{ 
                                color: 'error.main', 
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}>
                                ERROR
                              </Typography>
                            </>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ 
                          fontWeight: 600,
                          color: scenario.validationErrors.length === 0 ? 'text.primary' : 'text.secondary'
                        }}>
                          {scenario.label || '(No Label)'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            wordBreak: 'break-all',
                            maxWidth: 250,
                            color: scenario.validationErrors.length === 0 ? 'primary.main' : 'text.secondary',
                            fontSize: '0.8rem'
                          }}
                        >
                          {scenario.url || '(No URL)'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ 
                          backgroundColor: 'rgba(103, 58, 183, 0.1)',
                          color: 'secondary.dark',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          fontFamily: 'monospace'
                        }}>
                          {Array.isArray(scenario.selectors) 
                            ? scenario.selectors.join(', ') 
                            : scenario.selectors || 'document'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ 
                          color: 'text.secondary',
                          fontSize: '0.8rem'
                        }}>
                          {scenario.delay || 0}ms
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ 
                          color: 'text.secondary',
                          fontSize: '0.8rem'
                        }}>
                          {Math.round((scenario.misMatchThreshold || 0.1) * 100)}%
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {scenario.clickSelector && (
                            <Typography variant="caption" sx={{ 
                              backgroundColor: 'rgba(33, 150, 243, 0.1)',
                              color: 'primary.dark',
                              px: 0.8,
                              py: 0.2,
                              borderRadius: 0.5,
                              fontSize: '0.7rem'
                            }}>
                              Click
                            </Typography>
                          )}
                          {scenario.hoverSelector && (
                            <Typography variant="caption" sx={{ 
                              backgroundColor: 'rgba(156, 39, 176, 0.1)',
                              color: 'secondary.dark',
                              px: 0.8,
                              py: 0.2,
                              borderRadius: 0.5,
                              fontSize: '0.7rem'
                            }}>
                              Hover
                            </Typography>
                          )}
                          {!scenario.clickSelector && !scenario.hoverSelector && (
                            <Typography variant="caption" sx={{ 
                              color: 'text.disabled',
                              fontSize: '0.7rem'
                            }}>
                              None
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {scenario.validationErrors.length > 0 ? (
                          <Box>
                            {scenario.validationErrors.map((error, errorIndex) => (
                              <Typography 
                                key={errorIndex}
                                color="error" 
                                variant="caption" 
                                sx={{ 
                                  display: 'block',
                                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1,
                                  mb: 0.5,
                                  fontSize: '0.75rem'
                                }}
                              >
                                ⚠️ {error}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'success.main',
                              backgroundColor: 'rgba(76, 175, 80, 0.1)',
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            ✅ Ready to Import
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          borderTop: '1px solid rgba(0,0,0,0.1)'
        }}>
          <Button 
            onClick={() => {
              if (!externalLoading) {
                setPreviewOpen(false);
              }
            }} 
            disabled={externalLoading}
            variant="outlined"
            size="large"
            sx={{ 
              borderRadius: 2,
              px: 4,
              py: 1.5
            }}
          >
            Cancel Preview
          </Button>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {parsedScenarios.filter(s => s.validationErrors.length === 0).length} of {parsedScenarios.length} scenarios are valid
            </Typography>
            <Button
              onClick={handleConfirmUpload}
              variant="contained"
              size="large"
              disabled={isLoading || !parsedScenarios.some(s => s.validationErrors.length === 0)}
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <Check />}
              sx={{
                borderRadius: 2,
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #45a049 0%, #3d8b40 100%)',
                },
                '&:disabled': {
                  background: 'rgba(0,0,0,0.12)',
                }
              }}
            >
              {isLoading ? 'Importing...' : `Import ${parsedScenarios.filter(s => s.validationErrors.length === 0).length} Valid Scenarios`}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CSVScenarioUploader;
