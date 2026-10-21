import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  build: { chunkSizeWarningLimit: 650 },
  plugins: [{
    name: 'local-diary-api',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '');
      if (env.AI_GATEWAY_API_KEY) process.env.AI_GATEWAY_API_KEY = env.AI_GATEWAY_API_KEY;
      server.middlewares.use('/api/diary', async (req, res) => {
        let data = '';
        for await (const chunk of req) {
          data += chunk;
          if (data.length > 20000) { res.statusCode = 413; res.end(); return; }
        }
        req.body = data;
        res.status = code => { res.statusCode = code; return res; };
        res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
        const { default: handler } = await import('./api/diary.js');
        await handler(req, res);
      });
    }
  }]
}));
