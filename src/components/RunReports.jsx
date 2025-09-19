import React, { useState, useEffect } from 'react';
import './RunReports.css';

const RunReports = () => {
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runDetails, setRunDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects/project_1/runs');
      const data = await response.json();
      const runsData = data.runs || [];
      setRuns(runsData);
      
      // Auto-select the most recent completed run with a combined report
      const latestRunWithReport = runsData.find(run => 
        run.status === 'completed' && run.hasCombinedReport
      );
      
      if (latestRunWithReport && !selectedRun) {
        console.log('Auto-selecting latest run with combined report:', latestRunWithReport.runId);
        await fetchRunDetails(latestRunWithReport.runId);
      }
    } catch (err) {
      setError('Failed to fetch runs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRunDetails = async (runId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/project_1/runs/${runId}`);
      const data = await response.json();
      setRunDetails(data);
      setSelectedRun(runId);
    } catch (err) {
      setError('Failed to fetch run details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCombinedReport = (runId) => {
    window.open(`/api/projects/project_1/runs/${runId}/report`, '_blank');
  };

  const openBatchReport = (batchUrl) => {
    window.open(batchUrl, '_blank');
  };

  const openLatestCombinedReport = () => {
    const latestRunWithReport = runs.find(run => 
      run.status === 'completed' && run.hasCombinedReport
    );
    
    if (latestRunWithReport) {
      window.open(`/api/projects/project_1/runs/${latestRunWithReport.runId}/report`, '_blank');
    } else {
      alert('No completed runs with combined reports found. Please run some tests first.');
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'running': return '#ff9800';
      case 'failed': return '#f44336';
      default: return '#757575';
    }
  };

  if (loading && runs.length === 0) {
    return (
      <div className="run-reports-container">
        <div className="loading">Loading test runs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="run-reports-container">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="run-reports-container">
      <div className="run-reports-header">
        <h2>📊 Test Run Reports</h2>
        <p>Browse and view combined reports from all test runs</p>
        <button 
          className="latest-report-btn"
          onClick={openLatestCombinedReport}
          disabled={!runs.some(run => run.status === 'completed' && run.hasCombinedReport)}
        >
          🚀 View Latest Combined Report
        </button>
      </div>

      <div className="run-reports-layout">
        {/* Runs List */}
        <div className="runs-list">
          <h3>Recent Runs</h3>
          {runs.length === 0 ? (
            <div className="no-runs">
              <p>No test runs found</p>
              <p>Run some tests to see reports here</p>
            </div>
          ) : (
            runs.map((run) => (
              <div
                key={run.runId}
                className={`run-item ${selectedRun === run.runId ? 'selected' : ''}`}
                onClick={() => fetchRunDetails(run.runId)}
              >
                <div className="run-header">
                  <div className="run-id">{run.runId}</div>
                  <div 
                    className="run-status"
                    style={{ color: getStatusColor(run.status) }}
                  >
                    {run.status || 'unknown'}
                  </div>
                </div>
                <div className="run-meta">
                  <div className="run-date">{formatDate(run.timestamp)}</div>
                  <div className="run-stats">
                    {run.totalScenarios} scenarios • {run.totalBatches} batches
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Run Details */}
        <div className="run-details">
          {!selectedRun ? (
            <div className="no-selection">
              <p>Select a run to view details and reports</p>
            </div>
          ) : loading ? (
            <div className="loading">Loading run details...</div>
          ) : runDetails ? (
            <div className="run-details-content">
              <div className="run-details-header">
                <h3>Run: {selectedRun}</h3>
                <div className="run-meta-detailed">
                  <div>Status: <span style={{ color: getStatusColor(runDetails.meta?.status) }}>
                    {runDetails.meta?.status || 'unknown'}
                  </span></div>
                  <div>Started: {formatDate(runDetails.meta?.timestamp)}</div>
                  <div>Scenarios: {runDetails.meta?.totalScenarios}</div>
                  <div>Batches: {runDetails.meta?.totalBatches}</div>
                </div>
              </div>

              {/* Combined Report */}
              {runDetails.hasCombinedReport && (
                <div className="combined-report-section">
                  <h4>🎯 Combined Report</h4>
                  <div className="combined-report-card">
                    <div className="report-stats">
                      <div className="stat">
                        <span className="stat-number">{runDetails.combinedReportInfo?.total || 0}</span>
                        <span className="stat-label">Total</span>
                      </div>
                      <div className="stat passed">
                        <span className="stat-number">{runDetails.combinedReportInfo?.passed || 0}</span>
                        <span className="stat-label">Passed</span>
                      </div>
                      <div className="stat failed">
                        <span className="stat-number">{runDetails.combinedReportInfo?.failed || 0}</span>
                        <span className="stat-label">Failed</span>
                      </div>
                    </div>
                    <button 
                      className="view-report-btn"
                      onClick={() => openCombinedReport(selectedRun)}
                    >
                      View Combined Report
                    </button>
                  </div>
                </div>
              )}

              {/* Individual Batch Reports */}
              <div className="batch-reports-section">
                <h4>📦 Batch Reports</h4>
                <div className="batch-reports-grid">
                  {runDetails.batches?.map((batch) => (
                    <div key={`${batch.batchIndex}-${batch.timestamp}`} className="batch-card">
                      <div className="batch-header">
                        <span className="batch-index">Batch {batch.batchIndex}</span>
                        <span className="batch-timestamp">{batch.timestamp}</span>
                      </div>
                      {batch.hasHtmlReport ? (
                        <button 
                          className="view-batch-btn"
                          onClick={() => openBatchReport(batch.url)}
                        >
                          View Report
                        </button>
                      ) : (
                        <div className="no-report">No report available</div>
                      )}
                    </div>
                  )) || (
                    <div className="no-batches">No batch reports found</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="error">Failed to load run details</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RunReports;