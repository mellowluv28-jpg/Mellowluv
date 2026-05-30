const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SUPABASE_CONNECTION_STRING,
      ssl: { rejectUnauthorized: false },
      max: 5
    });
  }
  return pool;
}

function toPgSql(sql) {
  let i = 0;
  let result = sql
    .replace(/%d-%m/g, 'DD-MM')
    .replace(/%Y-%m-%d/g, 'YYYY-MM-DD')
    .replace(/datetime\('now'\)/gi, "NOW()")
    .replace(/strftime\('([^']+)'\s*,/g, "TO_CHAR(");
  return result.replace(/\?/g, () => `$${++i}`);
}

async function query(sql, params) {
  const client = getPool();
  const pgSql = toPgSql(sql);
  const result = await client.query(pgSql, params);
  return result.rows;
}

async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function execute(sql, params) {
  const client = getPool();
  const trimmed = sql.trim().toUpperCase();
  const isInsert = trimmed.startsWith('INSERT');
  const finalSql = isInsert ? sql + ' RETURNING id' : sql;
  const pgSql = toPgSql(finalSql);
  const result = await client.query(pgSql, params);
  return {
    changes: result.rowCount,
    lastInsertRowid: isInsert && result.rows.length > 0 ? result.rows[0].id : null
  };
}

async function transaction(fn) {
  const client = getPool();
  const dbClient = await client.connect();
  try {
    await dbClient.query('BEGIN');
    const result = await fn();
    await dbClient.query('COMMIT');
    return result;
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
}

module.exports = { getPool, query, queryOne, execute, transaction };
