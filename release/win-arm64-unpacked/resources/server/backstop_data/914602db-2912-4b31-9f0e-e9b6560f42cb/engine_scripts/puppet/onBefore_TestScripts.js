module.exports = async (page, scenario, vp, isReference, Engine, config) => {
  console.log('BEFORE > ' + scenario.label);
  
  // Set viewport if specified
  if (vp) {
    await page.setViewport({ width: vp.width, height: vp.height });
  }
  
  // Custom onBefore script execution
  try {
    // Test onBefore script with mixed APIs
    await page.evaluate(async () => {
      sessionStorage.setItem("testBefore", "working");
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.evaluate(async () => {
      document.body.style.display = "block";
    });
  } catch (error) {
    console.warn('Custom onBefore script error for scenario "' + scenario.label + '":', error.message);
  }
  
  // Wait for page to be ready
  await page.waitForSelector('body', { timeout: 30000 });
};