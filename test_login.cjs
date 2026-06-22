const sdk = require('matrix-js-sdk');

const tempClient = sdk.createClient({ baseUrl: 'https://chating.qpi.digital' });

async function test() {
  try {
    const res = await tempClient.loginWithPassword('testuser456_temp', 'testpassword123');
    console.log('Success login!', res);
  } catch (err) {
    console.error('Failed login:', err.message, err.data);
  }
}

test();
