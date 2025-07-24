# PixelPilot BackstopJS Dashboard

This project provides a web-based dashboard for managing BackstopJS visual regression tests. Users can configure BackstopJS settings, manage scenarios, set breakpoints, and upload screenshots via an intuitive React UI. The backend will be powered by Node.js/Express and will integrate BackstopJS for running and managing tests.

## Features
- Edit BackstopJS config (scenarios, viewports, etc.)
- Manage breakpoints and scenarios
- Upload screenshots for different breakpoints
- Run BackstopJS tests from the dashboard

## Getting Started
1. Install dependencies: `npm install`
2. Start the frontend: `npm run dev`
3. Backend setup: (to be added)

## Next Steps
- Add backend (Node.js/Express) for API endpoints
- Integrate BackstopJS
- Build React UI for config and screenshot management

---
For workspace-specific Copilot instructions, see `.github/copilot-instructions.md`.
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
