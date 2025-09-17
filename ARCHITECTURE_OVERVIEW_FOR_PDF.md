# Pixel Pilot Architecture Overview

## 1. Purpose
Pixel Pilot is a web-based dashboard for managing, executing, and reporting BackstopJS visual regression tests at scale. It supports batch processing, scenario management, real-time progress, and historical test tracking.

---

## 2. High-Level Components

### A. Frontend (React)
- UI Components: ScenarioManager, TestRunner, ConfigEditor, ScreenshotUploader, URL Clone Tool, Batch History Viewer.
- State Management: Local React state, API-driven updates.
- Real-Time Updates: Socket.IO for live test progress and notifications.
- CSV Import/Export: For bulk scenario management and feature status tracking.

### B. Backend (Node.js/Express)
- API Endpoints: RESTful endpoints for scenario CRUD, batch test execution, config management, batch history, and report serving.
- Batch Processor: Handles large test suites, splits into batches, manages concurrency, and writes results to timestamped folders.
- BackstopJS Integration: Spawns BackstopJS CLI for each batch, with isolated config and output folders.
- File Management: Uses `fs-extra` for robust file operations, including batch folder creation and metadata storage.
- Socket.IO: Pushes real-time progress, warnings, and completion events to the frontend.

### C. Data Storage
- Config Files: BackstopJS config per project, editable via UI.
- Batch Folders: Each test run (even single scenario) creates a unique batch folder with timestamp, containing all test assets and metadata.
- Reference Images: Stored in a static folder, can be updated from any batch.
- Batch Metadata: Each batch folder contains a `batch-meta.json` file with run details (timestamp, scenario count, status).

---

## 3. Key Workflows

### A. Scenario Management
- Add/edit/delete/search scenarios via UI.
- Import/export scenarios as CSV.
- Filter scenarios for targeted test runs.

### B. Test Execution
- User selects scenarios and starts a test.
- Frontend sends batch config to backend (always batch, even for single scenario).
- Backend validates only filtered scenarios, creates batch folder, and runs BackstopJS.
- Progress and results streamed to frontend via Socket.IO.

### C. Batch History & Reporting
- Each run is preserved in its own batch folder.
- Batch metadata and reports are accessible via API and UI.
- Users can browse, compare, and export results.

### D. Reference Management
- Reference images are static.
- Option to update/copy reference images from any batch.

### E. URL Cloning & Extraction
- Clone URLs from target/reference sites using CSS selectors.
- Ensures unique scenario labels and proper mapping.

---

## 4. API Endpoints (Sample)
- `POST /api/projects/:projectId/test` — Run batch test.
- `GET /api/projects/:projectId/batches` — List batch history and metadata.
- `GET /api/projects/:projectId/report` — Serve batch reports.
- `POST /api/projects/:projectId/scenarios` — Manage scenarios.
- `POST /api/clone-urls` — Clone URLs from a site.

---

## 5. Batch Folder Structure
```
backstop_data/
  bitmaps_test/
    batch_0/
      20250913-123456/
        [test images, logs, batch-meta.json, report]
    batch_1/
      20250914-101010/
        ...
  bitmaps_reference/
    [reference images]
  html_report/
    batch_0/
      20250913-123456/
        index.html, report.json
    ...
```

---

## 6. Extensibility
- New features (permissions, CI/CD integration, custom exports) can be added via new API endpoints and UI components.
- Batch logic is consistent for all runs, enabling robust history and analytics.

---

## 7. Technology Stack
- **Frontend:** React, Material UI, Axios, Socket.IO-client
- **Backend:** Node.js, Express, Socket.IO, BackstopJS, fs-extra, cheerio, axios
- **Data:** JSON config, batch metadata, CSV for import/export

---

## 8. Security & Permissions
- (Planned) Role-based access for teams.
- API endpoints can be secured via middleware.

---

## 9. Deployment
- Can be deployed on any Node.js-compatible server.
- Frontend served via Vite/React build.
- Backend runs as Express server.

---

## 10. Architecture Diagram

![Architecture Diagram](architecture-diagram.png)

---

## 11. Summary
Pixel Pilot provides a scalable, user-friendly platform for visual regression testing, with robust batch history, real-time feedback, and extensible architecture for enterprise needs.
