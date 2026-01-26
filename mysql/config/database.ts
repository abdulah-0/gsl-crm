import mysql from 'mysql2/promise';

// MySQL connection configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'gsl_crm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00', // Store all dates in UTC
};

// Create connection pool
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// Get a connection from the pool
export async function getConnection(): Promise<mysql.PoolConnection> {
  const pool = getPool();
  return await pool.getConnection();
}

// Execute a query with automatic connection handling
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

// Execute a query and return the first row
export async function queryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Execute an insert and return the inserted ID
export async function insert(
  sql: string,
  params?: any[]
): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute(sql, params);
  return (result as any).insertId;
}

// Execute an update/delete and return affected rows
export async function execute(
  sql: string,
  params?: any[]
): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute(sql, params);
  return (result as any).affectedRows;
}

// Transaction helper
export async function transaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ MySQL connection successful');
    return true;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error);
    return false;
  }
}

// Close all connections
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Helper to escape identifiers (table/column names)
export function escapeId(identifier: string): string {
  return '`' + identifier.replace(/`/g, '``') + '`';
}

// Helper to build WHERE clause from object
export function buildWhereClause(
  conditions: Record<string, any>
): { sql: string; params: any[] } {
  const keys = Object.keys(conditions);
  if (keys.length === 0) {
    return { sql: '', params: [] };
  }

  const clauses = keys.map(key => `${escapeId(key)} = ?`);
  const params = keys.map(key => conditions[key]);

  return {
    sql: 'WHERE ' + clauses.join(' AND '),
    params,
  };
}

// Helper to build INSERT statement
export function buildInsert(
  table: string,
  data: Record<string, any>
): { sql: string; params: any[] } {
  const keys = Object.keys(data);
  const columns = keys.map(escapeId).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const params = keys.map(key => data[key]);

  return {
    sql: `INSERT INTO ${escapeId(table)} (${columns}) VALUES (${placeholders})`,
    params,
  };
}

// Helper to build UPDATE statement
export function buildUpdate(
  table: string,
  data: Record<string, any>,
  conditions: Record<string, any>
): { sql: string; params: any[] } {
  const dataKeys = Object.keys(data);
  const setClauses = dataKeys.map(key => `${escapeId(key)} = ?`).join(', ');
  const setParams = dataKeys.map(key => data[key]);

  const { sql: whereClause, params: whereParams } = buildWhereClause(conditions);

  return {
    sql: `UPDATE ${escapeId(table)} SET ${setClauses} ${whereClause}`,
    params: [...setParams, ...whereParams],
  };
}

export default {
  getPool,
  getConnection,
  query,
  queryOne,
  insert,
  execute,
  transaction,
  testConnection,
  closePool,
  escapeId,
  buildWhereClause,
  buildInsert,
  buildUpdate,
};
