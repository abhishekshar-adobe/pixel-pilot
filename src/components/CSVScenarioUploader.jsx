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

const CSVScenarioUploader = ({ onScenariosCreated }) => {
  const [csvData, setCSVData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsedScenarios, setParsedScenarios] = useState([]);

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
    setError('');
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv') {
      setError('Please upload a CSV file');
      return;
    }

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transform: (value) => value.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Error parsing CSV file: ' + results.errors[0].message);
          setLoading(false);
          return;
        }

        const scenarios = results.data.filter(row => row.label || row.url);
        const validScenarios = scenarios.map(scenario => {
          const validationErrors = validateScenario(scenario);
          return { ...scenario, validationErrors };
        });

        setParsedScenarios(validScenarios);
        setPreviewOpen(true);
        setLoading(false);
      },
      error: (error) => {
        setError('Error reading CSV file: ' + error.message);
        setLoading(false);
      }
    });
  };

  const handleConfirmUpload = () => {
    const validScenarios = parsedScenarios
      .filter(scenario => scenario.validationErrors.length === 0)
      .map(scenario => ({
        ...scenario,
        id: Date.now() + Math.random() // Ensure unique IDs
      }));

    if (validScenarios.length > 0) {
      onScenariosCreated(validScenarios);
      setPreviewOpen(false);
      setParsedScenarios([]);
    }
  };

  return (
    <>
      <Card sx={{ p: 3, mb: 3, border: '2px dashed', borderColor: 'divider' }}>
        <Box display="flex" flexDirection="column" alignItems="center">
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
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Upload />}
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
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Preview Scenarios from CSV</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Selectors</TableCell>
                  <TableCell>Validation</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsedScenarios.map((scenario, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {scenario.validationErrors.length === 0 ? (
                        <Check sx={{ color: 'success.main' }} />
                      ) : (
                        <Error sx={{ color: 'error.main' }} />
                      )}
                    </TableCell>
                    <TableCell>{scenario.label}</TableCell>
                    <TableCell>{scenario.url}</TableCell>
                    <TableCell>{Array.isArray(scenario.selectors) ? scenario.selectors.join(', ') : scenario.selectors}</TableCell>
                    <TableCell>
                      {scenario.validationErrors.length > 0 ? (
                        <Typography color="error" variant="caption">
                          {scenario.validationErrors.join(', ')}
                        </Typography>
                      ) : (
                        <Typography color="success.main" variant="caption">
                          Valid
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmUpload}
            variant="contained"
            disabled={!parsedScenarios.some(s => s.validationErrors.length === 0)}
          >
            Import {parsedScenarios.filter(s => s.validationErrors.length === 0).length} Valid Scenarios
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CSVScenarioUploader;
