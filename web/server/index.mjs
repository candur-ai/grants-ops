import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { authMiddleware } from './middleware/auth.mjs';
import { rateLimiter } from './middleware/rateLimit.mjs';
import profileRoutes from './routes/profile.mjs';
import applicationsRoutes from './routes/applications.mjs';
import pipelineRoutes from './routes/pipeline.mjs';
import grantsRoutes from './routes/grants.mjs';
import reportsRoutes from './routes/reports.mjs';
import evaluateRoutes from './routes/evaluate.mjs';
import narrativeRoutes from './routes/narrative.mjs';
import budgetRoutes from './routes/budget.mjs';
import applicationPacketsRoutes from './routes/applicationPackets.mjs';
import statesRoutes from './routes/states.mjs';
import dashboardRoutes from './routes/dashboard.mjs';
import searchProviderRoutes from './routes/searchProvider.mjs';
import debateRoutes from './routes/debate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Public product APIs
app.use('/api/v1/search-provider', searchProviderRoutes);
app.use('/api/v1/debate', rateLimiter(20), debateRoutes);

// API routes (all require auth)
app.use('/api/v1/profile', authMiddleware, profileRoutes);
app.use('/api/v1/applications', authMiddleware, applicationsRoutes);
app.use('/api/v1/pipeline', authMiddleware, pipelineRoutes);
app.use('/api/v1/grants', authMiddleware, grantsRoutes);
app.use('/api/v1/reports', authMiddleware, reportsRoutes);
app.use('/api/v1/evaluate', authMiddleware, rateLimiter(10), evaluateRoutes);
app.use('/api/v1/narrative', authMiddleware, rateLimiter(20), narrativeRoutes);
app.use('/api/v1/budget', authMiddleware, rateLimiter(10), budgetRoutes);
app.use('/api/v1/application-packets', authMiddleware, applicationPacketsRoutes);
app.use('/api/v1/states', authMiddleware, statesRoutes);
app.use('/api/v1/dashboard', authMiddleware, dashboardRoutes);

// Serve static files in production
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get(/.*/, (_req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

if (!process.env.VERCEL && isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Grants-Ops server running on http://localhost:${PORT}`);
  });
}

export default app;
