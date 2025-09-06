const axios = require('axios');

async function testSpecificURL() {
  const url = 'https://aem.enablementadobe.com/content/asset-share-commons/en/light/details/image.html/content/dam/asset-share-commons/en/public/pictures/ariel-lustre-251415.jpg';
  
  console.log(`Testing URL: ${url}\n`);
  
  try {
    console.log('🔍 Starting validation...');
    
    // Test with same logic as validateUrl function
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Manual timeout after 5 seconds')), 5000);
    });
    
    const requestPromise = axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'PixelPilot-BackstopJS-Validator/1.0'
      },
      validateStatus: function () {
        return true; // Don't throw on any status code
      },
      maxRedirects: 3
    });

    console.log('🌐 Making request...');
    const response = await Promise.race([requestPromise, timeoutPromise]);
    
    console.log(`📡 Response received:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);
    console.log(`   Content Length: ${response.headers['content-length'] || 'unknown'}`);
    console.log(`   Content Type: ${response.headers['content-type'] || 'unknown'}`);
    
    if (response.status >= 200 && response.status < 400) {
      console.log('✅ URL should be considered VALID');
    } else if (response.status >= 400 && response.status < 500) {
      console.log('❌ URL has CLIENT ERROR');
    } else if (response.status >= 500) {
      console.log('❌ URL has SERVER ERROR');
    }
    
  } catch (error) {
    console.log(`❌ Error occurred:`);
    console.log(`   Code: ${error.code}`);
    console.log(`   Message: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   Type: CONNECTION_REFUSED');
    } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_NONAME') {
      console.log('   Type: DNS_ERROR');
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      console.log('   Type: TIMEOUT');
    } else if (error.message?.includes('Manual timeout')) {
      console.log('   Type: MANUAL_TIMEOUT');
    } else {
      console.log('   Type: NETWORK_ERROR');
    }
  }
}

testSpecificURL();
