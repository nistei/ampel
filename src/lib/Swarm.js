import Request from './Request';
import uniqueId from '../utils/uniqueId';
import { getRemoteAddress, getXFF } from '../utils';

const DEFAULT_TIMEOUT_IN_MS = 10000;

export default class Swarm {
  constructor (backends, req, res) {
    this.id = uniqueId();
    this.backends = backends;
    this.req = req;
    this.res = res;
    this.proxies = [];
    this.responded = false;
  }

  dispatch () {
    console.log(this._log(`Dispatching ${this.req.method} Swarm request...`));
    const _options = Object.assign({}, {
      protocol: 'http:',
      method: this.req.method,
      headers: Object.assign({}, this.req.headers, {
        'X-Forwarded-For': getXFF(this.req),
      }),
      path: this.req.url
    });
    for (let i = 0; i < this.backends.length; i++) {
      const upstream = new Request(this.backends[i], _options);
      upstream.setOnResponse(this._handleResponse.bind(this));
      upstream.dispatch();
      upstream.pipe(this.req);
      this.proxies.push(upstream);
    }
    this.started = +new Date();
    this.timeoutId = setTimeout(this._handleTimeout.bind(this), DEFAULT_TIMEOUT_IN_MS);
  }

  _handleResponse (req) {
    const res = req.res;
    const code = res.statusCode;
    const id = req.id;
    if (this.responded) {
      req.consume();
      return;
    }
    if (code < 200 && code > 299) {
      console.log(this._log(`Received status code ${code} from one of the upstream backends (Id: ${id}). Retrying...`));
      req.retry();
      return;
    }
    clearTimeout(this.timeoutId);
    this.res.setHeader('X-Served-By', getRemoteAddress(res));
    this.res.writeHead(res.statusCode, res.headers);
    res.pipe(this.res);
    this.responded = true;
  }

  _handleTimeout () {
    if (!this.responded) {
      console.log(this._log(`Swarm timed out. None of the upstream backends has responded with 201. Aborting.`));
      this.res.writeHead(502);
      this.res.end('502 Bad Gateway');
      for (let i = 0; i < this.proxies.length; i++) {
        this.proxies[i].abort();
      }
    }
  }

  _log (message) {
    const now = new Date();
    return `[${now} Swarm Id: ${this.id}] ` + message;
  }
}
