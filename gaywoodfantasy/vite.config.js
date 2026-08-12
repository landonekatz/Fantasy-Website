import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to serve json files from /data/ at dev time and copy at build time
function serveDataPlugin() {
  return {
    name: 'serve-data-plugin',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const cleanUrl = req.url.split('?')[0];
        const filePath = path.join(__dirname, 'data', cleanUrl);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });
    },
    closeBundle() {
      const srcDir = path.join(__dirname, 'data');
      const destDir = path.join(__dirname, 'dist', 'data');
      if (fs.existsSync(srcDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        for (const file of fs.readdirSync(srcDir)) {
          if (file.endsWith('.json')) {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
          }
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [serveDataPlugin()],
  server: {
    port: 3001,  // Different port from main site
    open: false,
    host: true
  },
  publicDir: 'public',
  build: {
    outDir: 'dist'
  }
});
