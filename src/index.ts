import dotenv from 'dotenv';
dotenv.config();
// Validate env and expose normalized config
import { config } from './utils/config';

import { createServer } from './server';

const port = config.port;

const app = createServer();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`OTP service listening on port ${port}`);
});
