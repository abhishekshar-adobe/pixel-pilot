const processCustomScript = (customCode) => {
  if (!customCode || !customCode.trim()) return '';
  
  const lines = customCode.split('\n');
  let result = '';
  let inBrowserContext = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Handle empty lines and comments
    if (!trimmed || trimmed.startsWith('//')) {
      if (inBrowserContext) {
        result += '      ' + line + '\n'; // Comments inside browser context get extra indented
      } else {
        result += '    ' + line + '\n'; // Comments outside browser context get base indented
      }
      continue;
    }

    // Detect browser APIs vs Node.js APIs
    const hasBrowserAPI = /\b(document|window|localStorage|sessionStorage|console\.log|alert)\b/.test(trimmed);
    const hasNodeAPI = /\b(page\.|await page|context\(\)|addCookies|setExtraHTTPHeaders|waitFor|click|type|keyboard|mouse)\b/.test(trimmed);

    if (hasBrowserAPI && !hasNodeAPI) {
      // Browser API - needs to run in page.evaluate()
      if (!inBrowserContext) {
        result += '    await page.evaluate(async () => {\n';
        inBrowserContext = true;
      }
      result += '      ' + line + '\n';
    } else {
      // Node.js API or mixed - close browser context if open
      if (inBrowserContext) {
        result += '    });\n';
        inBrowserContext = false;
      }
      result += '    ' + line + '\n';
    }
  }

  // Close any remaining browser context
  if (inBrowserContext) {
    result += '    });\n';
  }

  return result.trim();
};

// Test more complex mixed script
const testScript = `// Set up authentication
sessionStorage.setItem('authToken', 'test-token');
localStorage.setItem('userPrefs', '{"theme":"dark"}');

// Wait for page to load
await page.waitForSelector('.main-content', {visible: true});

// Modify DOM elements
document.getElementById('sidebar').style.display = 'none';
window.scrollTo(0, 0);

// Interact with page
await page.hover('.hover-trigger');
await page.keyboard.press('Escape');

// Clear storage
sessionStorage.clear();`;

console.log('=== INPUT ===');
console.log(testScript);
console.log('\n=== OUTPUT ===');
console.log(processCustomScript(testScript));
