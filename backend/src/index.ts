import 'dotenv/config';
import { createApp } from './app.js';
import { startWatcher } from './watcher.js';

const app = createApp();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`SolSwapAI backend listening on http://localhost:${PORT}`);
});

// Start background watcher (stubbed)
startWatcher();


