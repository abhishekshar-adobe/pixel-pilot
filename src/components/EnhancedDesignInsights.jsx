import React, { useState, useEffect } from 'react';
import './EnhancedDesignInsights.css';

const EnhancedDesignInsights = ({ analysisResults, onRunEnhancedAnalysis }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedItems, setExpandedItems] = useState(new Set());

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'visual', label: '🔍 Visual Analysis', icon: '🔍' },
    { id: 'issues', label: '🔥 Issues', icon: '🔥' },
    { id: 'recommendations', label: '💡 Recommendations', icon: '💡' },
    { id: 'actions', label: '✅ Action Items', icon: '✅' }
  ];

  const handleRunEnhancedAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await onRunEnhancedAnalysis();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleExpanded = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#dc3545',
      high: '#fd7e14',
      major: '#fd7e14',
      medium: '#ffc107',
      moderate: '#ffc107',
      low: '#28a745',
      minor: '#28a745'
    };
    return colors[severity?.toLowerCase()] || '#6c757d';
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#4caf50';
    if (score >= 80) return '#8bc34a';
    if (score >= 70) return '#ffeb3b';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  const renderOverviewTab = () => {
    if (!analysisResults) {
      return (
        <div className="no-data">
          <div className="no-data-content">
            <div className="no-data-icon">🎨</div>
            <h3>No Enhanced Analysis Available</h3>
            <p>Run an enhanced design comparison to see detailed insights, visual analysis, and actionable recommendations.</p>
            <button 
              className="btn btn-primary"
              onClick={handleRunEnhancedAnalysis}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? '🔄 Analyzing...' : '🚀 Run Enhanced Analysis'}
            </button>
          </div>
        </div>
      );
    }

    const { detailedInsights, visualAnalysis, comparison } = analysisResults;
    const totalIssues = detailedInsights?.prioritizedIssues?.length || 0;
    const criticalIssues = detailedInsights?.prioritizedIssues?.filter(i => i.severity === 'critical')?.length || 0;
    const averageVisualScore = visualAnalysis?.overallInsights?.averageScores?.visual || 0;

    return (
      <div className="overview-content">
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-value">{totalIssues}</div>
            <div className="metric-label">Total Issues</div>
            <div className="metric-trend">
              {criticalIssues > 0 && (
                <span className="trend-critical">⚠️ {criticalIssues} Critical</span>
              )}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-value" style={{ color: getScoreColor(averageVisualScore) }}>
              {averageVisualScore}%
            </div>
            <div className="metric-label">Visual Similarity</div>
            <div className="score-bar">
              <div 
                className="score-fill" 
                style={{ 
                  width: `${averageVisualScore}%`,
                  backgroundColor: getScoreColor(averageVisualScore)
                }}
              />
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-value">{comparison?.totalMismatches || 0}</div>
            <div className="metric-label">Token Mismatches</div>
            <div className="metric-trend">
              {comparison?.mismatches?.length > 0 && (
                <span>🎯 {comparison.mismatches.length} Elements</span>
              )}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-value">{detailedInsights?.actionableItems?.length || 0}</div>
            <div className="metric-label">Action Items</div>
            <div className="metric-trend">
              <span>📋 Ready to implement</span>
            </div>
          </div>
        </div>

        {visualAnalysis?.overallInsights && (
          <div className="insights-summary">
            <h3>📈 Overall Performance</h3>
            <div className="performance-grid">
              <div className="performance-item">
                <span className="performance-label">Color Accuracy:</span>
                <div className="performance-bar">
                  <div 
                    className="performance-fill"
                    style={{ 
                      width: `${visualAnalysis.overallInsights.averageScores.color}%`,
                      backgroundColor: getScoreColor(visualAnalysis.overallInsights.averageScores.color)
                    }}
                  />
                </div>
                <span className="performance-value">{visualAnalysis.overallInsights.averageScores.color}%</span>
              </div>

              <div className="performance-item">
                <span className="performance-label">Layout Precision:</span>
                <div className="performance-bar">
                  <div 
                    className="performance-fill"
                    style={{ 
                      width: `${visualAnalysis.overallInsights.averageScores.layout}%`,
                      backgroundColor: getScoreColor(visualAnalysis.overallInsights.averageScores.layout)
                    }}
                  />
                </div>
                <span className="performance-value">{visualAnalysis.overallInsights.averageScores.layout}%</span>
              </div>

              <div className="performance-item">
                <span className="performance-label">Structure Match:</span>
                <div className="performance-bar">
                  <div 
                    className="performance-fill"
                    style={{ 
                      width: `${visualAnalysis.overallInsights.averageScores.structure}%`,
                      backgroundColor: getScoreColor(visualAnalysis.overallInsights.averageScores.structure)
                    }}
                  />
                </div>
                <span className="performance-value">{visualAnalysis.overallInsights.averageScores.structure}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderVisualAnalysisTab = () => {
    const { visualAnalysis } = analysisResults || {};
    
    if (!visualAnalysis || !visualAnalysis.enhancedAnalysis) {
      return (
        <div className="no-data">
          <div className="no-data-content">
            <div className="no-data-icon">🔍</div>
            <h3>No Visual Analysis Data</h3>
            <p>Visual analysis requires BackstopJS test results with failed tests to analyze.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="visual-analysis-content">
        <div className="analysis-header">
          <h3>🎨 Enhanced Visual Analysis</h3>
          <div className="analysis-stats">
            <span className="stat-item">
              📸 {visualAnalysis.enhancedAnalysis.length} Tests Analyzed
            </span>
            {visualAnalysis.backstopResults && (
              <span className="stat-item">
                🔄 BackstopJS Integration Active
              </span>
            )}
          </div>
        </div>

        <div className="visual-tests-grid">
          {visualAnalysis.enhancedAnalysis.map((testAnalysis, index) => (
            <div key={index} className="visual-test-card">
              <div className="test-header">
                <h4>{testAnalysis.testId}</h4>
                <span className="viewport-badge">{testAnalysis.viewport}</span>
              </div>

              {testAnalysis.analysis.insights && (
                <div className="test-insights">
                  <div className="overall-score">
                    <span>Overall Score:</span>
                    <div className="score-display">
                      <div 
                        className="score-circle"
                        style={{ 
                          backgroundColor: getScoreColor(testAnalysis.analysis.insights.overall?.score || 0)
                        }}
                      >
                        {testAnalysis.analysis.insights.overall?.score || 0}%
                      </div>
                    </div>
                  </div>

                  {testAnalysis.analysis.insights.specific && (
                    <div className="specific-insights">
                      <h5>Specific Issues:</h5>
                      {testAnalysis.analysis.insights.specific.slice(0, 3).map((insight, idx) => (
                        <div key={idx} className="insight-item">
                          <span 
                            className="insight-severity"
                            style={{ backgroundColor: getSeverityColor(insight.severity) }}
                          >
                            {insight.severity}
                          </span>
                          <span className="insight-message">{insight.message}</span>
                        </div>
                      ))}
                      {testAnalysis.analysis.insights.specific.length > 3 && (
                        <div className="insight-more">
                          +{testAnalysis.analysis.insights.specific.length - 3} more issues
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {testAnalysis.analysis.comparison && (
                <div className="comparison-metrics">
                  <div className="metric-row">
                    <span>Color Similarity:</span>
                    <span>{testAnalysis.analysis.comparison.colorDifference?.overallSimilarity || 0}%</span>
                  </div>
                  <div className="metric-row">
                    <span>Layout Score:</span>
                    <span>{testAnalysis.analysis.comparison.layoutDifference?.layoutScore || 0}%</span>
                  </div>
                  <div className="metric-row">
                    <span>Structural Match:</span>
                    <span>{testAnalysis.analysis.comparison.structuralSimilarity?.overall || 0}%</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderIssuesTab = () => {
    const { detailedInsights } = analysisResults || {};
    
    if (!detailedInsights || !detailedInsights.prioritizedIssues) {
      return (
        <div className="no-data">
          <div className="no-data-content">
            <div className="no-data-icon">🔥</div>
            <h3>No Issues Found</h3>
            <p>Great! No significant issues were detected in the analysis.</p>
          </div>
        </div>
      );
    }

    const { prioritizedIssues } = detailedInsights;
    const severityGroups = prioritizedIssues.reduce((groups, issue) => {
      const severity = issue.severity || 'unknown';
      if (!groups[severity]) groups[severity] = [];
      groups[severity].push(issue);
      return groups;
    }, {});

    return (
      <div className="issues-content">
        <div className="issues-header">
          <h3>🔥 Prioritized Issues</h3>
          <div className="severity-summary">
            {Object.entries(severityGroups).map(([severity, issues]) => (
              <span 
                key={severity}
                className="severity-badge"
                style={{ backgroundColor: getSeverityColor(severity) }}
              >
                {severity}: {issues.length}
              </span>
            ))}
          </div>
        </div>

        <div className="issues-list">
          {prioritizedIssues.slice(0, 20).map((issue, index) => (
            <div 
              key={index} 
              className={`issue-card ${expandedItems.has(`issue-${index}`) ? 'expanded' : ''}`}
            >
              <div className="issue-header" onClick={() => toggleExpanded(`issue-${index}`)}>
                <div className="issue-priority">
                  <span 
                    className="priority-indicator"
                    style={{ backgroundColor: getSeverityColor(issue.severity) }}
                  >
                    #{index + 1}
                  </span>
                  <div className="issue-title">
                    <h4>{issue.description}</h4>
                    <div className="issue-meta">
                      <span className="issue-element">📍 {issue.element}</span>
                      <span className="issue-category">🏷️ {issue.category}</span>
                      <span className="issue-source">📊 {issue.source}</span>
                    </div>
                  </div>
                </div>
                <div className="issue-actions">
                  <span 
                    className="severity-tag"
                    style={{ backgroundColor: getSeverityColor(issue.severity) }}
                  >
                    {issue.severity}
                  </span>
                  <span className="impact-tag">Impact: {issue.impact}</span>
                  <div className="expand-icon">
                    {expandedItems.has(`issue-${index}`) ? '⬆️' : '⬇️'}
                  </div>
                </div>
              </div>

              {expandedItems.has(`issue-${index}`) && (
                <div className="issue-details">
                  <div className="detail-section">
                    <h5>🎯 Issue Details</h5>
                    <p><strong>Type:</strong> {issue.type}</p>
                    <p><strong>Category:</strong> {issue.category}</p>
                    <p><strong>Severity:</strong> {issue.severity}</p>
                    <p><strong>Impact Score:</strong> {issue.impact}</p>
                  </div>

                  <div className="detail-section">
                    <h5>📍 Location</h5>
                    <p><strong>Element:</strong> {issue.element}</p>
                    <p><strong>Source:</strong> {issue.source}</p>
                  </div>

                  <div className="detail-section">
                    <h5>💡 Description</h5>
                    <p>{issue.description}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {prioritizedIssues.length > 20 && (
          <div className="load-more">
            <p>Showing top 20 issues. {prioritizedIssues.length - 20} more issues available.</p>
          </div>
        )}
      </div>
    );
  };

  const renderRecommendationsTab = () => {
    const { enhancedRecommendations } = analysisResults || {};
    
    if (!enhancedRecommendations) {
      return (
        <div className="no-data">
          <div className="no-data-content">
            <div className="no-data-icon">💡</div>
            <h3>No Recommendations Available</h3>
            <p>Run an enhanced analysis to generate personalized recommendations.</p>
          </div>
        </div>
      );
    }

    const recommendationSections = [
      { key: 'immediate', title: '🚨 Immediate Actions', color: '#dc3545' },
      { key: 'shortTerm', title: '📅 Short-term Improvements', color: '#fd7e14' },
      { key: 'longTerm', title: '🎯 Long-term Goals', color: '#17a2b8' },
      { key: 'process', title: '🔄 Process Improvements', color: '#6f42c1' },
      { key: 'tooling', title: '🛠️ Tooling & Automation', color: '#28a745' }
    ];

    return (
      <div className="recommendations-content">
        <div className="recommendations-header">
          <h3>💡 Enhanced Recommendations</h3>
          <p>Personalized recommendations based on your specific issues and analysis results.</p>
        </div>

        {recommendationSections.map(section => {
          const recommendations = enhancedRecommendations[section.key] || [];
          if (recommendations.length === 0) return null;

          return (
            <div key={section.key} className="recommendation-section">
              <div className="section-header" style={{ borderLeft: `4px solid ${section.color}` }}>
                <h4>{section.title}</h4>
                <span className="recommendation-count">{recommendations.length} recommendations</span>
              </div>

              <div className="recommendations-grid">
                {recommendations.map((rec, index) => (
                  <div key={index} className="recommendation-card">
                    <div className="recommendation-header">
                      <h5>{rec.title}</h5>
                      <div className="recommendation-badges">
                        <span 
                          className="priority-badge"
                          style={{ backgroundColor: getSeverityColor(rec.priority) }}
                        >
                          {rec.priority}
                        </span>
                        <span className="effort-badge">Effort: {rec.effort}</span>
                        <span className="impact-badge">Impact: {rec.impact}</span>
                      </div>
                    </div>

                    <div className="recommendation-body">
                      <p>{rec.description}</p>
                      {rec.timeframe && (
                        <div className="timeframe">
                          <span>⏱️ Timeframe: {rec.timeframe}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderActionItemsTab = () => {
    const { detailedInsights } = analysisResults || {};
    
    if (!detailedInsights || !detailedInsights.actionableItems) {
      return (
        <div className="no-data">
          <div className="no-data-content">
            <div className="no-data-icon">✅</div>
            <h3>No Action Items Generated</h3>
            <p>Action items will be generated when issues are found in the analysis.</p>
          </div>
        </div>
      );
    }

    const { actionableItems } = detailedInsights;

    return (
      <div className="actions-content">
        <div className="actions-header">
          <h3>✅ Action Items</h3>
          <p>Concrete steps to resolve the issues found in your design implementation.</p>
        </div>

        <div className="actions-list">
          {actionableItems.map((item, index) => (
            <div 
              key={index} 
              className={`action-card ${expandedItems.has(`action-${index}`) ? 'expanded' : ''}`}
            >
              <div className="action-header" onClick={() => toggleExpanded(`action-${index}`)}>
                <div className="action-info">
                  <h4>{item.title}</h4>
                  <div className="action-meta">
                    <span className="action-category">🏷️ {item.category}</span>
                    <span className="action-effort">⚡ {item.estimatedEffort} effort</span>
                  </div>
                </div>
                <div className="action-priority">
                  <span 
                    className="priority-indicator"
                    style={{ backgroundColor: getSeverityColor(item.priority) }}
                  >
                    {item.priority}
                  </span>
                  <div className="expand-icon">
                    {expandedItems.has(`action-${index}`) ? '⬆️' : '⬇️'}
                  </div>
                </div>
              </div>

              <div className="action-description">
                <p>{item.description}</p>
              </div>

              {expandedItems.has(`action-${index}`) && (
                <div className="action-details">
                  <div className="steps-section">
                    <h5>📋 Implementation Steps</h5>
                    <ol className="steps-list">
                      {item.steps.map((step, stepIndex) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="verification-section">
                    <h5>✅ Verification Steps</h5>
                    <ol className="verification-list">
                      {item.verification.map((step, stepIndex) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="enhanced-design-insights">
      <div className="insights-header">
        <h2>🎨 Enhanced Design Insights</h2>
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={handleRunEnhancedAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '🔄 Analyzing...' : '🔄 Refresh Analysis'}
          </button>
        </div>
      </div>

      <div className="insights-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'visual' && renderVisualAnalysisTab()}
        {activeTab === 'issues' && renderIssuesTab()}
        {activeTab === 'recommendations' && renderRecommendationsTab()}
        {activeTab === 'actions' && renderActionItemsTab()}
      </div>
    </div>
  );
};

export default EnhancedDesignInsights;
