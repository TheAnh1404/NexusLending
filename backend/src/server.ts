import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './prisma/client.js';
import { indexerService } from './modules/indexer/indexer.service.js';

// Start Soroban event indexer in background.
indexerService.start();

const server = app.listen(env.port, () => {
  console.log(`Nexus backend listening on port ${env.port}`);
});

const shutdown = async (): Promise<void> => {
  indexerService.stop();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});
