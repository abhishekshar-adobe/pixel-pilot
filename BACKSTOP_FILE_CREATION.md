# BackstopJS File Creation in Batch Mode

## Overview
This document explains exactly how BackstopJS creates files when running in our batch processing system.

## Key Points
1. **BackstopJS writes to EXACT paths** we specify in the config
2. **No automatic subdirectories** - we must create them first
3. **File naming follows BackstopJS conventions**
4. **Reports go to separate html_report path**

## File Structure Created

### For 4 Test Scenarios (Single Batch):
```
backstop_data/
  {projectId}/
    batch_runs/
      run_1726666123456_abc123/           # Unique runId
        run-meta.json                     # Run metadata (our addition)
        batch_0/                          # First (and only) batch
          20250918-143052/                # Batch timestamp
            batch-meta.json               # Batch metadata (our addition)
            
            # BackstopJS Screenshot Files:
            backstop_default_scenario1_0_phone.png
            backstop_default_scenario1_1_tablet.png
            backstop_default_scenario1_2_desktop.png
            backstop_default_scenario2_0_phone.png
            backstop_default_scenario2_1_tablet.png
            backstop_default_scenario2_2_desktop.png
            backstop_default_scenario3_0_phone.png
            backstop_default_scenario3_1_tablet.png
            backstop_default_scenario3_2_desktop.png
            backstop_default_scenario4_0_phone.png
            backstop_default_scenario4_1_tablet.png
            backstop_default_scenario4_2_desktop.png
            
            # Failed Diff Images (if tests fail):
            failed_diff_backstop_default_scenario1_0_phone.png
            failed_diff_backstop_default_scenario2_1_tablet.png
            # ... etc for any failed tests
    
    html_report/
      run_1726666123456_abc123/
        combined_report.json              # Merged results (our addition)
        batch_0/
          20250918-143052/
            index.html                    # Interactive BackstopJS report
            report.json                   # JSON test results
            config.js                     # BackstopJS report config
    
    bitmaps_reference/                    # Reference images (unchanged)
      backstop_default_scenario1_0_phone.png
      backstop_default_scenario1_1_tablet.png
      # ... etc for all scenarios/viewports
```

## BackstopJS File Naming Convention

### Screenshot Files:
- **Pattern**: `backstop_default_{scenarioLabel}_{viewportIndex}_{viewportLabel}.png`
- **Example**: `backstop_default_Homepage_0_phone.png`
- **Failed Diffs**: `failed_diff_backstop_default_{scenarioLabel}_{viewportIndex}_{viewportLabel}.png`

### Report Files:
- **index.html**: Interactive HTML report with image comparisons
- **report.json**: JSON data with test results, pass/fail status, mismatch percentages
- **config.js**: BackstopJS configuration used for the report

## Our Batch Processing Additions

### Run Metadata (`run-meta.json`):
```json
{
  "runId": "run_1726666123456_abc123",
  "timestamp": "20250918143052",
  "totalBatches": 1,
  "totalScenarios": 4,
  "batchSize": 4,
  "maxConcurrent": 10,
  "status": "completed",
  "startTime": "2025-09-18T14:30:52.000Z",
  "endTime": "2025-09-18T14:32:15.000Z",
  "duration": 83000,
  "sessionId": "test_1726666252000_abc123def"
}
```

### Batch Metadata (`batch-meta.json`):
```json
{
  "runId": "run_1726666123456_abc123",
  "batchIndex": 0,
  "timestamp": "20250918143052",
  "scenarioCount": 4,
  "scenarios": ["Homepage", "About", "Contact", "Services"],
  "status": "completed",
  "startTime": "2025-09-18T14:30:52.000Z",
  "endTime": "2025-09-18T14:32:15.000Z",
  "exitCode": 0
}
```

### Combined Report (`combined_report.json`):
```json
{
  "testSuite": "BatchTest_test-project_run_1726666123456_abc123",
  "tests": [/* merged results from all batches */],
  "date": "2025-09-18T14:32:15.000Z",
  "runId": "run_1726666123456_abc123",
  "batchInfo": {
    "totalBatches": 1,
    "batchSize": 4,
    "totalScenarios": 4,
    "sessionId": "test_1726666252000_abc123def",
    "runId": "run_1726666123456_abc123"
  },
  "summary": {
    "passed": 3,
    "failed": 1,
    "total": 4
  }
}
```

## How It Works

1. **Frontend sends request** with 4 selected scenarios
2. **Backend creates batch config** with custom paths:
   - `bitmaps_test`: `batch_runs/{runId}/batch_0/{timestamp}/`
   - `html_report`: `html_report/{runId}/batch_0/{timestamp}/`
3. **Directories created** before BackstopJS runs
4. **BackstopJS executes** and writes files to exact paths specified
5. **Our system adds metadata** files for tracking
6. **Combined report generated** merging all batch results

## Benefits

- **Isolated runs**: Each test run gets its own folder
- **Historical tracking**: All runs preserved with timestamps
- **Batch visibility**: Individual and combined reports available
- **Consistent structure**: Works for 1 scenario or 10,000 scenarios
- **No conflicts**: Parallel runs don't interfere with each other

## API Endpoints

- `/api/projects/{projectId}/runs` - List all runs
- `/api/projects/{projectId}/runs/{runId}` - Get specific run details
- `/api/projects/{projectId}/runs/{runId}/batches` - Get batches for a run
- `/api/projects/{projectId}/report/combined.html?run={runId}` - Combined report
- `/api/projects/{projectId}/report/index.html?run={runId}&batch=0&timestamp={timestamp}` - Individual batch report