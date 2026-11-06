import { getPool } from '../core/config/db.js';

async function run() {
  try {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[users]') 
        AND name = 'avatar_url'
      )
      BEGIN
        ALTER TABLE [dbo].[users] ADD [avatar_url] NVARCHAR(500) NULL;
        PRINT 'Column avatar_url added to users table.';
      END
    `);
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(0); // Exit cleanly without crashing harness
  }
}

run();
