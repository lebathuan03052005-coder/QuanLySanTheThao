import { runSprint2Seed } from './seed_sprint2.js';

runSprint2Seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Lỗi khi chạy seed:', err);
    process.exit(1);
  });
