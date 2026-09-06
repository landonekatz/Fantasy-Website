import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to serve multi-league json files during dev and copy at build time
function serveMultiLeagueDataPlugin() {
  return {
    name: 'serve-multi-league-data-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const cleanUrl = req.url.split('?')[0];

        // Handle /dmsfantasy/data/...
        if (cleanUrl.startsWith('/dmsfantasy/data/')) {
          const relPath = cleanUrl.replace('/dmsfantasy/data/', '');
          const filePath = path.join(__dirname, 'dmsfantasy', 'data', relPath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const contentType = relPath.endsWith('.js') ? 'text/javascript' : 'application/json';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            return fs.createReadStream(filePath).pipe(res);
          }
        }


        // Handle /api/* serverless functions locally
        if (cleanUrl.startsWith('/api/')) {
          const endpoint = cleanUrl.replace(/^\/api\//, '').split('?')[0];
          const apiFilePath = path.join(__dirname, 'api', `${endpoint}.js`);
          if (fs.existsSync(apiFilePath)) {
            return (async () => {
              try {
                const mod = await import(`file://${apiFilePath}?t=${Date.now()}`);
                const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                const query = Object.fromEntries(parsedUrl.searchParams.entries());
                let body = {};
                if (req.method === 'POST') {
                  const buffers = [];
                  for await (const chunk of req) {
                    buffers.push(chunk);
                  }
                  const raw = Buffer.concat(buffers).toString();
                  try { body = JSON.parse(raw); } catch (e) { body = raw; }
                }
                const customReq = Object.assign(req, { query, body });
                const customRes = Object.assign(res, {
                  status(code) { res.statusCode = code; return this; },
                  json(data) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                    return this;
                  }
                });
                await mod.default(customReq, customRes);
              } catch (err) {
                console.error('Local API Error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            })();
          }
        }

        const urlNoQuery = req.url.split('?')[0];
        const normalized = urlNoQuery.replace(/\/$/, '');

        // Redirect deprecated standalone Gaywood portal to Vault league
        if (normalized === '/gaywoodfantasy' || normalized.startsWith('/gaywoodfantasy/')) {
          res.writeHead(301, { Location: '/gaywoodfantasyfootball' });
          return res.end();
        }

        // Handle Dumbarton portal: commuted to native Vault league powered by Firebase RTDB
        if (normalized === '/dmsfantasy' || urlNoQuery === '/dmsfantasy/index.html') {
          req.url = '/vault.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
          return next();
        }

        // Fallback for dynamic league vaults (e.g. /gaywoodfantasyfootball, /ironclad, /my-league)
        // If the URL has no extension and isn't root or a specific directory
        if (!urlNoQuery.includes('.') && normalized !== '' && normalized !== '/') {
          req.url = '/vault.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
        }

        next();
      });
    },
    closeBundle() {
      // Copy dmsfantasy/data to dist/dmsfantasy/data
      const dmsSrc = path.join(__dirname, 'dmsfantasy', 'data');
      const dmsDest = path.join(__dirname, 'dist', 'dmsfantasy', 'data');
      if (fs.existsSync(dmsSrc)) {
        fs.mkdirSync(dmsDest, { recursive: true });
        for (const file of fs.readdirSync(dmsSrc)) {
          if (file.endsWith('.json') || file.endsWith('.js')) {
            fs.copyFileSync(path.join(dmsSrc, file), path.join(dmsDest, file));
          }
        }
      }
      // Copy dmsfantasy pngs to dist/dmsfantasy
      const dmsRoot = path.join(__dirname, 'dmsfantasy');
      const dmsDistRoot = path.join(__dirname, 'dist', 'dmsfantasy');
      if (fs.existsSync(dmsRoot)) {
        for (const file of fs.readdirSync(dmsRoot)) {
          if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.svg')) {
            fs.copyFileSync(path.join(dmsRoot, file), path.join(dmsDistRoot, file));
          }
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [serveMultiLeagueDataPlugin()],
  server: {
    port: 3000,
    open: false,
    host: true
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        vault: path.resolve(__dirname, 'vault.html')
      }
    }
  }
});
