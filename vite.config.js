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
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return fs.createReadStream(filePath).pipe(res);
          }
        }

        // Handle /gaywoodfantasy/data/...
        if (cleanUrl.startsWith('/gaywoodfantasy/data/')) {
          const relPath = cleanUrl.replace('/gaywoodfantasy/data/', '');
          const filePath = path.join(__dirname, 'gaywoodfantasy', 'data', relPath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return fs.createReadStream(filePath).pipe(res);
          }
        }

        // Fallback for dynamic league slugs (Vercel rewrite equivalent)
        // If the URL has no extension and isn't root or a specific directory
        if (!cleanUrl.includes('.') && cleanUrl !== '/' && cleanUrl !== '/dmsfantasy' && cleanUrl !== '/gaywoodfantasy') {
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

      // Copy gaywoodfantasy/data to dist/gaywoodfantasy/data
      const gaywoodSrc = path.join(__dirname, 'gaywoodfantasy', 'data');
      const gaywoodDest = path.join(__dirname, 'dist', 'gaywoodfantasy', 'data');
      if (fs.existsSync(gaywoodSrc)) {
        fs.mkdirSync(gaywoodDest, { recursive: true });
        for (const file of fs.readdirSync(gaywoodSrc)) {
          if (file.endsWith('.json') || file.endsWith('.js')) {
            fs.copyFileSync(path.join(gaywoodSrc, file), path.join(gaywoodDest, file));
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
        vault: path.resolve(__dirname, 'vault.html'),
        dmsfantasy: path.resolve(__dirname, 'dmsfantasy/index.html'),
        gaywoodfantasy: path.resolve(__dirname, 'gaywoodfantasy/index.html')
      }
    }
  }
});
