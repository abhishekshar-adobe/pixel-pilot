module.exports = async (page, scenario, vp, isReference, Engine, config) => {
  await require('./onBefore.js')(page, scenario, vp, isReference, Engine, config);
  
  // Custom script execution
  try {
    // Test onReady script with mixed APIs
    await page.evaluate(async () => {
      sessionStorage.setItem("testReady", "working");
    });
    await page.waitForSelector("body", {visible: true});
    await page.evaluate(async () => {
      document.body.style.backgroundColor = "lightblue";
    });
  } catch (error) {
    console.warn('Custom onReady script error for scenario "' + scenario.label + '":', error.message);
  }
  
  // Wait a bit for any changes to settle
  await new Promise(resolve => setTimeout(resolve, 500));
};