import { sql } from './sqlite.js';

/**
 * families — partner, parent and children, keyed by user and shared across
 * servers, exactly the shape labubu's Family model had.
 */

const shape = (doc) => ({
  userId: doc.userId,
  partnerId: doc.partnerId ?? null,
  parent: doc.parent ?? null,
  children: [...(doc.children ?? [])],
});

/** the user's family record, created empty on first use. */
export async function get(userId) {
  sql().prepare('INSERT OR IGNORE INTO family (user_id) VALUES (?)').run(userId);

  const row = sql().prepare('SELECT * FROM family WHERE user_id = ?').get(userId);

  return shape({
    userId: row.user_id,
    partnerId: row.partner_id,
    parent: row.parent,
    children: JSON.parse(row.children),
  });
}

/** write a record back. */
export async function save(record) {
  const next = shape(record);

  sql()
    .prepare(`
      INSERT INTO family (user_id, partner_id, parent, children) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET
        partner_id = excluded.partner_id,
        parent = excluded.parent,
        children = excluded.children
    `)
    .run(next.userId, next.partnerId, next.parent, JSON.stringify(next.children));

  return next;
}
