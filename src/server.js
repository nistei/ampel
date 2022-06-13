import http from 'http';

import Config from '../config.json';
import Backend from './lib/Backend';
import * as Handlers from './handlers';

const PORT = process.env.PORT || 8080;
const UPSTREAM_BACKENDS = Config.backends.map(url => new Backend(url));

const SwarmHandler = Handlers.SwarmHandler(UPSTREAM_BACKENDS);

const ampel = http.createServer(function (req, res) {
  try {
    res.setHeader('X-Powered-By', 'Ampel');
    SwarmHandler(req, res);
  }
  catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end('500 Internal Server Error');
  }
});

ampel.listen(PORT, () => {
  console.log(`Ampel is running at http://127.0.0.1:${PORT}/`);
});
