#!/usr/bin/env node

/**
 * Link Comparison Script
 * 
 * What This Script Does:
 * - Loads both STAGE and QA pages
 * - Extracts all links (resolves relative URLs)
 * - Compares all paths (e.g., /about, /contact)
 * - Prints a comparison table with ✅/❌ for each link on both environments
 */

const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

// Configuration
const STAGE_URL = process.argv[2] || 'https://example.com';
const QA_URL = process.argv[3] || 'https://www.iana.org';

// Create axios instance with proper configuration
const crawler = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 60000
  })
});

/**
 * Extract internal navigation links from a webpage
 */
async function extractLinks(url) {
  try {
    console.log(`🔍 Scanning: ${url}`);
    const response = await crawler.get(url);
    const $ = cheerio.load(response.data);
    const links = new Set();
    const baseHostname = new URL(url).hostname;
    let totalHrefs = 0;
    
    // Extract all href attributes
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      totalHrefs++;
      
      if (href) {
        try {
          // Convert relative URLs to absolute
          let absoluteUrl;
          if (href.startsWith('http')) {
            absoluteUrl = new URL(href);
          } else {
            absoluteUrl = new URL(href, url);
          }
          
          // Only include links from the same domain
          if (absoluteUrl.hostname === baseHostname) {
            let path = absoluteUrl.pathname;
            
            // Normalize path
            if (path.endsWith('/') && path.length > 1) {
              path = path.slice(0, -1);
            }
            
            // Filter out non-navigation links
            const isValidPath = path && 
              path !== '/' && 
              path.length > 1 &&
              !path.includes('.pdf') &&
              !path.includes('.jpg') &&
              !path.includes('.jpeg') &&
              !path.includes('.png') &&
              !path.includes('.gif') &&
              !path.includes('.svg') &&
              !path.includes('.css') &&
              !path.includes('.js') &&
              !path.includes('.ico') &&
              !path.includes('.woff') &&
              !path.startsWith('/cdn-cgi/') &&
              !path.includes('mailto:') &&
              !path.includes('tel:');
            
            if (isValidPath) {
              links.add(path);
            }
          }
        } catch {
          // Skip invalid URLs
        }
      }
    });
    
    console.log(`   📊 Found ${totalHrefs} total links, extracted ${links.size} navigation paths`);
    return Array.from(links).sort();
  } catch (error) {
    console.error(`❌ Error scanning ${url}:`, error.message);
    return [];
  }
}

/**
 * Print a comparison table
 */
function printComparisonTable(stageLinks, qaLinks, stageUrl, qaUrl) {
  const allPaths = new Set([...stageLinks, ...qaLinks]);
  const comparison = Array.from(allPaths).map(path => ({
    path,
    onStage: stageLinks.includes(path),
    onQA: qaLinks.includes(path)
  })).sort((a, b) => a.path.localeCompare(b.path));

  console.log('\n📋 LINK COMPARISON TABLE');
  console.log('='.repeat(80));
  console.log(`STAGE: ${stageUrl}`);
  console.log(`QA:    ${qaUrl}`);
  console.log('='.repeat(80));
  console.log('Path'.padEnd(50) + 'STAGE'.padEnd(8) + 'QA'.padEnd(8) + 'Status');
  console.log('-'.repeat(80));

  comparison.forEach(item => {
    const stageIcon = item.onStage ? '✅' : '❌';
    const qaIcon = item.onQA ? '✅' : '❌';
    
    let status = '';
    if (item.onStage && item.onQA) {
      status = '🟢 BOTH';
    } else if (item.onStage) {
      status = '🟡 STAGE ONLY';
    } else {
      status = '🔴 QA ONLY';
    }
    
    console.log(
      item.path.padEnd(50) + 
      stageIcon.padEnd(8) + 
      qaIcon.padEnd(8) + 
      status
    );
  });

  console.log('-'.repeat(80));
  console.log('📈 SUMMARY:');
  console.log(`   Total unique paths: ${comparison.length}`);
  console.log(`   On both environments: ${comparison.filter(item => item.onStage && item.onQA).length}`);
  console.log(`   STAGE only: ${comparison.filter(item => item.onStage && !item.onQA).length}`);
  console.log(`   QA only: ${comparison.filter(item => !item.onStage && item.onQA).length}`);
  console.log(`   STAGE total paths: ${stageLinks.length}`);
  console.log(`   QA total paths: ${qaLinks.length}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Link Comparison Tool');
  console.log('========================');
  
  if (process.argv.length < 4) {
    console.log('Usage: node link-comparison-script.js <STAGE_URL> <QA_URL>');
    console.log('Example: node link-comparison-script.js https://staging.example.com https://qa.example.com');
    console.log('\nUsing default URLs for demo...\n');
  }
  
  try {
    // Extract links from both environments
    const [stageLinks, qaLinks] = await Promise.all([
      extractLinks(STAGE_URL),
      extractLinks(QA_URL)
    ]);

    // Print comparison table
    printComparisonTable(stageLinks, qaLinks, STAGE_URL, QA_URL);
    
    console.log('\n✅ Comparison completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during comparison:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { extractLinks, printComparisonTable };
