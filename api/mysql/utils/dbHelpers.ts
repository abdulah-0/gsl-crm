import { query, queryOne, buildWhereClause, buildSetClause } from '../../mysql/config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Generic CRUD operations for any table
 */
export class TableOperations {
    constructor(private tableName: string) { }

    /**
     * Get all records with optional filtering
     */
    async getAll(filters: Record<string, any> = {}, orderBy = 'created_at DESC', limit?: number) {
        const { where, params } = buildWhereClause(filters);
        const limitClause = limit ? `LIMIT ${limit}` : '';

        const sql = `SELECT * FROM ${this.tableName} ${where} ORDER BY ${orderBy} ${limitClause}`;
        return await query<RowDataPacket[]>(sql, params);
    }

    /**
     * Get a single record by ID
     */
    async getById(id: string | number) {
        const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
        return await queryOne<RowDataPacket>(sql, [id]);
    }

    /**
     * Get a single record by filters
     */
    async getOne(filters: Record<string, any>) {
        const { where, params } = buildWhereClause(filters);
        const sql = `SELECT * FROM ${this.tableName} ${where} LIMIT 1`;
        return await queryOne<RowDataPacket>(sql, params);
    }

    /**
     * Create a new record
     */
    async create(data: Record<string, any>) {
        const fields = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);

        const sql = `INSERT INTO ${this.tableName} (${fields}) VALUES (${placeholders})`;
        const result = await query<ResultSetHeader>(sql, values);

        return {
            id: result.insertId,
            affectedRows: result.affectedRows
        };
    }

    /**
     * Update a record by ID
     */
    async update(id: string | number, data: Record<string, any>) {
        const { set, params } = buildSetClause(data);
        params.push(id);

        const sql = `UPDATE ${this.tableName} SET ${set} WHERE id = ?`;
        const result = await query<ResultSetHeader>(sql, params);

        return {
            affectedRows: result.affectedRows,
            changedRows: result.changedRows
        };
    }

    /**
     * Update records by filters
     */
    async updateWhere(filters: Record<string, any>, data: Record<string, any>) {
        const { set, params: setParams } = buildSetClause(data);
        const { where, params: whereParams } = buildWhereClause(filters);

        const sql = `UPDATE ${this.tableName} SET ${set} ${where}`;
        const result = await query<ResultSetHeader>(sql, [...setParams, ...whereParams]);

        return {
            affectedRows: result.affectedRows,
            changedRows: result.changedRows
        };
    }

    /**
     * Delete a record by ID
     */
    async delete(id: string | number) {
        const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
        const result = await query<ResultSetHeader>(sql, [id]);

        return {
            affectedRows: result.affectedRows
        };
    }

    /**
     * Delete records by filters
     */
    async deleteWhere(filters: Record<string, any>) {
        const { where, params } = buildWhereClause(filters);
        const sql = `DELETE FROM ${this.tableName} ${where}`;
        const result = await query<ResultSetHeader>(sql, params);

        return {
            affectedRows: result.affectedRows
        };
    }

    /**
     * Count records with optional filtering
     */
    async count(filters: Record<string, any> = {}) {
        const { where, params } = buildWhereClause(filters);
        const sql = `SELECT COUNT(*) as count FROM ${this.tableName} ${where}`;
        const result = await queryOne<any>(sql, params);
        return result?.count || 0;
    }

    /**
     * Check if a record exists
     */
    async exists(filters: Record<string, any>) {
        const count = await this.count(filters);
        return count > 0;
    }
}

/**
 * Pagination helper
 */
export interface PaginationParams {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        pageSize: number;
        totalRecords: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
}

export async function paginate<T>(
    tableName: string,
    filters: Record<string, any> = {},
    params: PaginationParams = {}
): Promise<PaginatedResult<T>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const orderBy = params.orderBy || 'created_at';
    const orderDirection = params.orderDirection || 'DESC';

    const offset = (page - 1) * pageSize;

    const { where, params: whereParams } = buildWhereClause(filters);

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM ${tableName} ${where}`;
    const countResult = await queryOne<any>(countSql, whereParams);
    const totalRecords = countResult?.count || 0;
    const totalPages = Math.ceil(totalRecords / pageSize);

    // Get paginated data
    const dataSql = `
    SELECT * FROM ${tableName} 
    ${where} 
    ORDER BY ${orderBy} ${orderDirection} 
    LIMIT ${pageSize} OFFSET ${offset}
  `;
    const data = await query<T[]>(dataSql, whereParams);

    return {
        data,
        pagination: {
            page,
            pageSize,
            totalRecords,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1
        }
    };
}

/**
 * Search helper for full-text search
 */
export async function search(
    tableName: string,
    searchFields: string[],
    searchTerm: string,
    filters: Record<string, any> = {},
    limit = 50
) {
    const searchConditions = searchFields
        .map(field => `${field} LIKE ?`)
        .join(' OR ');

    const searchParams = searchFields.map(() => `%${searchTerm}%`);

    const { where: filterWhere, params: filterParams } = buildWhereClause(filters);
    const whereClause = filterWhere
        ? `${filterWhere} AND (${searchConditions})`
        : `WHERE (${searchConditions})`;

    const sql = `
    SELECT * FROM ${tableName} 
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

    return await query<RowDataPacket[]>(sql, [...filterParams, ...searchParams]);
}

/**
 * Batch insert helper
 */
export async function batchInsert(
    tableName: string,
    records: Record<string, any>[]
) {
    if (records.length === 0) return { affectedRows: 0 };

    const fields = Object.keys(records[0]);
    const placeholders = records.map(() =>
        `(${fields.map(() => '?').join(', ')})`
    ).join(', ');

    const values = records.flatMap(record =>
        fields.map(field => record[field])
    );

    const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES ${placeholders}`;
    const result = await query<ResultSetHeader>(sql, values);

    return {
        affectedRows: result.affectedRows
    };
}

/**
 * Generate unique ID helper
 */
export function generateId(prefix: string, length = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = prefix;
    for (let i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

/**
 * Date range filter helper
 */
export function dateRangeFilter(
    field: string,
    startDate?: string,
    endDate?: string
): { condition: string; params: string[] } {
    const conditions: string[] = [];
    const params: string[] = [];

    if (startDate) {
        conditions.push(`${field} >= ?`);
        params.push(startDate);
    }

    if (endDate) {
        conditions.push(`${field} <= ?`);
        params.push(endDate);
    }

    return {
        condition: conditions.join(' AND '),
        params
    };
}

export default {
    TableOperations,
    paginate,
    search,
    batchInsert,
    generateId,
    dateRangeFilter
};
