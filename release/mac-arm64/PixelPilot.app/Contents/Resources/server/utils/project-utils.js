const fs = require('fs-extra');
const path = require('path');

// Projects file path
const PROJECTS_FILE = path.join(__dirname, '..', 'data', 'projects.json');

/**
 * Validate that a project exists and return its config path
 * @param {string} projectId - The project ID to validate
 * @returns {Promise<{configPath: string}>} - Returns config path if valid
 * @throws {Error} - Throws error if project not found
 */
async function validateProject(projectId) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  // Check if projects file exists
  if (!await fs.pathExists(PROJECTS_FILE)) {
    throw new Error('Projects not found');
  }

  // Load projects and check if this project exists
  const projects = await fs.readJson(PROJECTS_FILE);
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    throw new Error(`Project with ID '${projectId}' not found`);
  }

  // Check if project directory exists
  const projectDir = path.join(__dirname, '..', 'backstop_data', projectId);
  if (!await fs.pathExists(projectDir)) {
    throw new Error(`Project directory not found for project '${projectId}'`);
  }

  // Check if config file exists
  const configPath = path.join(projectDir, 'backstop.json');
  if (!await fs.pathExists(configPath)) {
    throw new Error(`Config file not found for project '${projectId}'`);
  }

  return {
    project,
    projectDir,
    configPath
  };
}

/**
 * Get all projects
 * @returns {Promise<Array>} - Array of projects
 */
async function getAllProjects() {
  if (!await fs.pathExists(PROJECTS_FILE)) {
    return [];
  }
  return await fs.readJson(PROJECTS_FILE);
}

/**
 * Create a new project entry
 * @param {Object} projectData - Project data
 * @returns {Promise<Object>} - Created project
 */
async function createProject(projectData) {
  const projects = await getAllProjects();
  projects.push(projectData);
  await fs.writeJson(PROJECTS_FILE, projects, { spaces: 2 });
  return projectData;
}

/**
 * Delete a project
 * @param {string} projectId - Project ID to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteProject(projectId) {
  const projects = await getAllProjects();
  const filteredProjects = projects.filter(p => p.id !== projectId);
  
  if (projects.length === filteredProjects.length) {
    return false; // Project not found
  }
  
  await fs.writeJson(PROJECTS_FILE, filteredProjects, { spaces: 2 });
  return true;
}

module.exports = {
  validateProject,
  getAllProjects,
  createProject,
  deleteProject,
  PROJECTS_FILE
};
