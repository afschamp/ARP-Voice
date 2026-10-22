
import Database from 'better-sqlite3';

const db = new Database('balances.db');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS balances (
    user_id TEXT PRIMARY KEY,
    units INTEGER NOT NULL DEFAULT 0
      CHECK (units >= 0)
  );
`);

export function getBalance(userId) {
  const row = db.prepare(
    'SELECT units FROM balances WHERE user_id = ?'
  ).get(userId);

  return row ? row.units : 0;
}

export function createTestBalance(userId) {
  db.prepare(`
    INSERT OR IGNORE INTO balances (user_id, units)
    VALUES (?, 10)
  `).run(userId);

  return getBalance(userId);
}

export function spendUnit(userId) {
  const result = db.prepare(`
    UPDATE balances
    SET units = units - 1
    WHERE user_id = ? AND units >= 1
  `).run(userId);

  return result.changes === 1;
}
