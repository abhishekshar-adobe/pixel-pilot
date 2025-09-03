const axios = require('axios');

async function quickURLTest() {
  const urls = [
    'https://opensource.adobe.com/asset-share-commons/',
    'http://localhost:5175/scenarios', 
    'https://aem.enablementadobe.com/content/asset-share-commons/en/light/details/image.html/content/dam/asset-share-commons/en/public/pictures/ariel-lustre-251415.jpg'
  ];
  
  for (const url of urls) {
    console.log(`\n🔍 Testing: ${url}`);
    
    try {
      const start = Date.now();
      const response = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'PixelPilot-BackstopJS-Validator/1.0'
        },
        validateStatus: function () {
          return true; // Don't throw on any status code
        },
        maxRedirects: 5
      });
      
      const duration = Date.now() - start;
      console.log(`   ✅ Response: ${response.status} (${duration}ms)`);
      console.log(`   Status Text: ${response.statusText}`);
      
      if (response.status >= 200 && response.status < 400) {
        console.log(`   ✅ WOULD BE MARKED AS VALID`);
      } else {
        console.log(`   ❌ WOULD BE MARKED AS INVALID`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   ❌ WOULD BE MARKED AS INVALID`);
    }
  }
}

quickURLTest().catch(console.error);
