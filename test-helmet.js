import express from 'express';
import helmet from 'helmet';

const app = express();
app.use(helmet({
  hsts: false,
  contentSecurityPolicy: false
}));

app.get('/', (req, res) => res.send('ok'));
app.listen(9999, () => console.log('test-helmet ready on 9999'));
