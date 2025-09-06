module.exports = async (page, scenario, vp, isReference, Engine, config) => {
  console.log('BEFORE > ' + scenario.label);
  
  // Set viewport if specified
  if (vp) {
    await page.setViewport({ width: vp.width, height: vp.height });
  }
  
  // Custom onBefore script execution
  try {
    await page.evaluate(async () => {
      sessionStorage.setItem('has-shown-login-prompt', 'true');
    });
  } catch (error) {
    console.warn('Custom onBefore script error for scenario "' + scenario.label + '":', error.message);
  }
  
  // Wait for page to be ready
  await page.waitForSelector('body', { timeout: 30000 });
};