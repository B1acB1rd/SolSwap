import { memStore } from './store/mem.js';
import { watchDeposits } from './services/solana.js';

let running = false;

export async function startWatcher() {
  if (running) return;
  running = true;

  async function loop() {
    try {
      const active = Array.from({ length: 0 }); // placeholder; pull from memStore if needed
      await watchDeposits(active as any, async (_evt) => {
        // On deposit detection, update order and session states
        // This will be implemented when integrating real Solana polling
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('watcher error', e);
    } finally {
      setTimeout(loop, 5000);
    }
  }

  loop();
}


