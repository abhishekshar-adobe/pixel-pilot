module.exports = async (page, scenario, vp, isReference, Engine, config) => {
  await require('./onBefore.js')(page, scenario, vp, isReference, Engine, config);
  
  // Custom script execution
  try {
    await page.evaluate(async () => {
      sessionStorage.setItem('has-shown-login-prompt', 'true');
    });
  } catch (error) {
    console.warn('Custom onReady script error for scenario "' + scenario.label + '":', error.message);
  }
  
  // Wait a bit for any changes to settle
  await new Promise(resolve => setTimeout(resolve, 500));
};