import dotenv from 'dotenv';
dotenv.config();

import { createServer } from './server';

const port = process.env.PORT || 3000;

const app = createServer();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`OTP service listening on port ${port}`);
});
