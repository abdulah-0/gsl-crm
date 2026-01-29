import mysql from 'mysql2/promise';

// MySQL connection configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'gsl_crm',

  // SSL configuration for cloud providers (PlanetScale, AWS RDS, etc.)
  ssl: process.env.MYSQL_SSL === 'true' ? {
    rejectUnauthorized: true
  } : undefined,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Create connection pool
let pool: mysql.Pool | null = null;

export const getPool = (): mysql.Pool => {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
};

// Get a connection from the pool
export const getConnection = async (): Promise<mysql.PoolConnection> => {
  const pool = getPool();
  return await pool.getConnection();
};

// Execute a query
export const query = async <T = any>(
  sql: string,
  params?: any[]
): Promise<T> => {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows as T;
};

// Execute a query and return the first row
export const queryOne = async <T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> => {
  const rows = await query<T[]>(sql, params);
  return rows.length > 0 ? rows[0] : null;
};

// Transaction helper
export const transaction = async <T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> => {
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
};

// Close the pool
export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

// Test connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ MySQL connection successful');
    return true;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error);
    return false;
  }
};

// Helper to build WHERE clause from filters
export const buildWhereClause = (
  filters: Record<string, any>
): { where: string; params: any[] } => {
  const conditions: string[] = [];
  const params: any[] = [];

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      conditions.push(`${key} = ?`);
      params.push(value);
    }
  });

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
};

// Helper to build UPDATE SET clause
export const buildSetClause = (
  data: Record<string, any>
): { set: string; params: any[] } => {
  const fields: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  });

  const set = fields.join(', ');
  return { set, params };
};

export default {
  getPool,
  getConnection,
  query,
  queryOne,
  transaction,
  closePool,
  testConnection,
  buildWhereClause,
  buildSetClause,
};
