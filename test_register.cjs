const sdk = require('matrix-js-sdk');

const tempClient = sdk.createClient({ baseUrl: 'https://chating.qpi.digital' });

async function test() {
  try {
    await tempClient.registerRequest({ username: 'testuser456_temp', password: 'testpassword123' });
    console.log('Success first step?');
  } catch (err) {
    if (err.httpStatus === 401 && err.data && err.data.session) {
      console.log('Got session:', err.data.session);
      try {
        const res = await tempClient.registerRequest({
          username: 'testuser456_temp',
          password: 'testpassword123',
          session: err.data.session,
          auth: {
            type: 'm.login.dummy',
            session: err.data.session
          }
        });
        console.log('Success register!', res);
      } catch (err2) {
        console.error('Failed second step:', err2.message, err2.data);
      }
    } else {
      console.error('Failed first step:', err.message, err.data);
    }
  }
}

test();
