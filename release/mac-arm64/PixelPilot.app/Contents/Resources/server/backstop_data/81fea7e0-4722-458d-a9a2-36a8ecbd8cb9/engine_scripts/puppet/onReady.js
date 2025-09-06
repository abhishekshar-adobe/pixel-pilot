module.exports = async (page, scenario) => {
  console.log('SCENARIO > ' + scenario.label);
  
  // Wait for page to be ready (compatible with Puppeteer)
  try {
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
    // Additional wait for network activity to settle
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.log('Document ready state timeout, continuing...');
  }
  
  // Custom ready logic for different scenarios
  if (scenario.readySelector) {
    try {
      await page.waitForSelector(scenario.readySelector, { timeout: 30000 });
    } catch (error) {
      console.log(`Ready selector "${scenario.readySelector}" not found, continuing...`);
    }
  }
  
  // Additional wait time if specified
  if (scenario.delay) {
    await new Promise(resolve => setTimeout(resolve, scenario.delay));
  }
  
  // Hide elements if specified
  if (scenario.hideSelectors && scenario.hideSelectors.length > 0) {
    console.log('Hiding selectors:', scenario.hideSelectors);
    
    // Wait for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    for (const selector of scenario.hideSelectors) {
      try {
        // Try multiple times with delays for dynamic content
        let found = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          const count = await page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            
            if (elements.length > 0) {
              elements.forEach(el => {
                el.style.visibility = 'hidden !important';
                el.style.opacity = '0 !important';
                el.style.display = 'none !important';
              });
              return elements.length;
            }
            return 0;
          }, selector);
          
          if (count > 0) {
            console.log(`✓ Successfully hid ${count} elements for selector: ${selector}`);
            found = true;
            break;
          } else if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!found) {
          console.log(`⚠ No elements found for selector: ${selector} after 3 attempts`);
        }
      } catch (error) {
        console.log(`Error hiding selector "${selector}":`, error.message);
      }
    }
  }
  
  // Remove elements if specified
  if (scenario.removeSelectors && scenario.removeSelectors.length > 0) {
    for (const selector of scenario.removeSelectors) {
      await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        elements.forEach(el => el.remove());
      }, selector);
    }
  }
  
  // Handle hover interactions
  if (scenario.hoverSelector) {
    await page.hover(scenario.hoverSelector);
  }
  
  // Handle click interactions
  if (scenario.clickSelector) {
    await page.click(scenario.clickSelector);
    
    // Wait after interaction
    if (scenario.postInteractionWait) {
      await new Promise(resolve => setTimeout(resolve, scenario.postInteractionWait));
    }
  }
  
  // Final wait to ensure everything is settled
  await new Promise(resolve => setTimeout(resolve, 500));
};
