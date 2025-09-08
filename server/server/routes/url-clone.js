const express = require('express');
const { URL } = require('url');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const cheerio = require('cheerio');
const process = require('process');

// Create axios instance with custom config
const axiosInstance = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
  },
  httpsAgent: new (require('https').Agent)({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 60000
  })
});

// Helper function to normalize and clean URLs
function normalizeUrl(href, baseUrl) {
  try {
    // Handle relative URLs
    const fullUrl = new URL(href, baseUrl);
    
    // Remove trailing slashes, fragments, and normalize case
    let normalized = fullUrl.href
      .toLowerCase()
      .replace(/#.*$/, '')                // Remove fragments
      .replace(/\?$/, '')                 // Remove empty query strings
      .replace(/([^:]\/)\/+/g, '$1')      // Remove duplicate slashes
      .replace(/\/$/, '');                // Remove trailing slash
    
    // Remove common tracking parameters
    const urlObj = new URL(normalized);
    const searchParams = new URLSearchParams(urlObj.search);
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', '_ga'];
    trackingParams.forEach(param => searchParams.delete(param));
    
    // Rebuild URL without tracking params
    urlObj.search = searchParams.toString();
    return urlObj.href;
  } catch {
    console.warn('Invalid URL:', href);
    return null;
  }
}

// Helper function to get links from HTML
async function getAllLinks(url) {
  const selectors = [
    'a[href]',                    // Standard links
    'link[href]',                 // CSS and other resources
    '[data-href]',               // Custom data attributes
    '[data-url]',                // Custom URL attributes
    'nav a',                     // Navigation links
    '.menu a',                   // Menu links
    '.footer a',                 // Footer links
    'header a',                  // Header links
    '.navigation a',             // Navigation elements
    '[role="navigation"] a',     // ARIA navigation
    '.navbar a',                 // Bootstrap-style navigation
    '.nav-menu a',              // Common navigation class
    'button[href]'              // Buttons with hrefs
  ];

  try {
    console.log('Fetching:', url);
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);
    
    // Store both normalized URLs and their original forms
    const links = new Map(); // normalized URL -> Set of original URLs

    // Function to add a URL to our map of normalized -> original URLs
    const addUrl = (href, context = '') => {
      if (!href) return;
      
      // Skip invalid URLs and non-HTTP(S) protocols
      if (!href.match(/^(https?:)?\/\//i) && !href.startsWith('/')) return;
      
      const normalizedUrl = normalizeUrl(href, url);
      if (!normalizedUrl) return;
      
      // Only process URLs from the same domain
      const urlObj = new URL(normalizedUrl);
      const baseUrlObj = new URL(url);
      if (urlObj.hostname !== baseUrlObj.hostname) return;
      
      // Store the original URL under its normalized form
      if (!links.has(normalizedUrl)) {
        links.set(normalizedUrl, new Set());
      }
      links.get(normalizedUrl).add(href);
      
      // If we have context about where this link was found, store that too
      if (context) {
        links.get(normalizedUrl).add(`${context}: ${href}`);
      }
    };

    // Extract links from all potential sources
    for (const selector of selectors) {
      $(selector).each((_, element) => {
        const $el = $(element);
        
        // Check all possible URL attributes
        const urlAttrs = ['href', 'data-href', 'data-url', 'src', 'data-src'];
        for (const attr of urlAttrs) {
          const href = $el.attr(attr);
          if (href) {
            // Get element context for better mapping
            const context = $el.closest('[id]').attr('id') || 
                          $el.closest('[class]').attr('class') ||
                          selector;
            addUrl(href, context);
          }
        }
      });
    }

    // Process and validate all links
    const processedLinks = Array.from(links.entries()).map(([normalizedUrl, originalUrls]) => ({
      normalizedUrl,
      originalUrls: Array.from(originalUrls),
      valid: true
    }));

    // Return the processed results
    return {
      success: true,
      urls: processedLinks,
      normalized: processedLinks.map(link => link.normalizedUrl),
      mapping: Object.fromEntries(
        processedLinks.map(link => [
          link.normalizedUrl,
          link.originalUrls
        ])
      )
    };

  } catch (err) {
    console.error('Error fetching links:', err.message);
    throw err;
  }
}

const router = express.Router();

// Configure BackstopJS settings
const backstopConfig = {
  viewports: [
    {
      label: "phone",
      width: 320,
      height: 480
    },
    {
      label: "tablet",
      width: 768,
      height: 1024
    },
    {
      label: "desktop",
      width: 1920,
      height: 1080
    }
  ],
  paths: {
    bitmaps_reference: 'backstop_data/bitmaps_reference',
    bitmaps_test: 'backstop_data/bitmaps_test',
    engine_scripts: 'backstop_data/engine_scripts',
    html_report: 'backstop_data/html_report',
    ci_report: 'backstop_data/ci_report'
  },
  engine: 'puppeteer',
  report: ['browser'],
  debug: false
};

router.post('/clone-urls', async (req, res) => {
  try {
    const { targetUrl, referenceUrl, projectId } = req.body;
    if (!targetUrl || !projectId) {
      return res.status(400).json({ error: 'Target URL and project ID are required' });
    }

    console.log('Processing Target URL:', targetUrl);
    if (referenceUrl) {
      console.log('Processing Reference URL:', referenceUrl);
    }

    // Get all links from the target page
    const targetResult = await getAllLinks(targetUrl);
    
    if (!targetResult || !targetResult.urls || !Array.isArray(targetResult.urls)) {
      throw new Error('Failed to extract valid URLs from the target page');
    }

    // Get normalized URLs for scenarios
    const targetUrls = targetResult.normalized;

    if (!targetUrls || targetUrls.length === 0) {
      return res.status(400).json({
        error: 'No valid URLs found',
        message: 'Could not find any valid URLs to process on the target page'
      });
    }

    // Helper function to convert target URL to reference URL
    const convertToReferenceUrl = (targetPageUrl) => {
      if (!referenceUrl) return '';
      
      try {
        const targetBaseUrl = new URL(targetUrl);
        const referenceBaseUrl = new URL(referenceUrl);
        const targetPageUrlObj = new URL(targetPageUrl);
        
        // Replace the domain/host from target with reference
        return targetPageUrl.replace(targetBaseUrl.origin, referenceBaseUrl.origin);
      } catch {
        return '';
      }
    };

    // Create project directory
    const projectDir = path.join(process.cwd(), 'backstop_data', projectId);
    
    // Create scenarios from the URLs
    const scenarios = targetUrls.map(targetPageUrl => ({
      label: targetPageUrl.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(0, 50),
      url: targetPageUrl,
      referenceUrl: convertToReferenceUrl(targetPageUrl),
      readySelector: 'body',
      delay: 2000,
      hideSelectors: [],
      removeSelectors: [],
      selectors: ['viewport'],
      selectorExpansion: true,
      expect: 0,
      misMatchThreshold: 0.1,
    }));

    // Save results
    await fs.ensureDir(projectDir);
    
    // Save URL mapping for reference
    const mappingData = {
      targetUrl,
      referenceUrl: referenceUrl || null,
      timestamp: new Date().toISOString(),
      mapping: targetResult.mapping
    };
    
    await fs.writeJson(
      path.join(projectDir, 'url_mapping.json'),
      mappingData,
      { spaces: 2 }
    );

    // Create and save BackstopJS config
    const config = {
      ...backstopConfig,
      id: projectId,
      scenarios
    };

    await fs.writeJson(
      path.join(projectDir, 'backstop.json'),
      config,
      { spaces: 2 }
    );

    // Return success response
    res.json({
      message: 'URL processing completed',
      urlCount: targetUrls.length,
      scenarios: scenarios.length,
      targetUrl,
      referenceUrl: referenceUrl || null,
      mapping: targetResult.mapping
    });

  } catch (err) {
    console.error('Error in /clone-urls route:', err);
    res.status(500).json({
      error: 'Failed to process URLs',
      message: err.message
    });
  }
});

module.exports = router;
