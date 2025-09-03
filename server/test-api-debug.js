const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing /api/test endpoint...');
    const response = await axios.post('http://localhost:5000/api/test', {}, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000 // 30 second timeout
    });
    console.log('Response:', response.data);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('Request timeout - server may be hanging');
    } else if (error.response) {
      console.log('Server response error:', error.response.status, error.response.data);
    } else {
      console.log('Network error:', error.message);
    }
  }
}

testAPI();
