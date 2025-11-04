import dotenv from 'dotenv';
dotenv.config();
// Validate env and expose normalized config
import { config } from './utils/config';

import { createServer } from './server';
import { createLogger } from './utils/logger';

const port = config.port;
const logger = createLogger();

const app = createServer();

app.listen(port, () => {
  logger.info({ port }, 'OTP service listening');
});
