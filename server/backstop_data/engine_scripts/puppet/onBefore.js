module.exports = async (page, scenario) => {
  console.log('BEFORE > ' + scenario.label);
  
  // Set viewport if specified
  if (scenario.viewport) {
    await page.setViewportSize({
      width: scenario.viewport.width || 1024,
      height: scenario.viewport.height || 768
    });
  }
  
  // Set cookies if cookie path is specified
  if (scenario.cookiePath) {
    try {
      const fs = require('fs');
      const path = require('path');
      const cookiePath = path.resolve(scenario.cookiePath);
      
      if (fs.existsSync(cookiePath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
        if (cookies && cookies.length > 0) {
          await page.context().addCookies(cookies);
        }
      }
    } catch (error) {
      console.log('Cookie loading failed:', error.message);
    }
  }

  // Set your localStorage items here (with error handling)
  try {
    await page.evaluate(() => {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        localStorage.setItem('has-shown-login-prompt', 'true');
      }
    });
  } catch (error) {
    console.log('localStorage access denied or unavailable:', error.message);
    // Continue without localStorage - this is not critical for screenshots
  }
  
  // Set user agent if needed
  await page.setExtraHTTPHeaders({
    'User-Agent': 'BackstopJS'
  });
};
