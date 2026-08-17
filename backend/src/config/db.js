
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: Number(process.env.DB_POOL_SIZE || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
});

const replacePlaceholders = sql => {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
};

const normalizeSql = sql => replacePlaceholders(String(sql))
    .replace(/DATE_ADD\(NOW\(\),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "(NOW() + INTERVAL '$1 days')")
    .replace(/NOW\(\)\s*-\s*INTERVAL\s+(\d+)\s+DAY/gi, "NOW() - INTERVAL '$1 days'")
    .replace(/CONCAT\('%',\s*(\$\d+),\s*'%'\)/gi, "('%' || $1 || '%')")
    .replace(/\bAS\s+(totalUsers|totalAdmins|totalTables|totalViews|totalSearches|recentLogins|activeAccounts|activeInLast7Days|inactiveAccounts)\b/gi, 'AS "$1"');

const normalizeResult = result => ({
    ...result,
    affectedRows: result.rowCount,
    changedRows: result.command === 'UPDATE' ? result.rowCount : undefined,
    insertId: result.rows[0]?.id
});

const normalizeQueryResult = result => {
    if (result.command === 'SELECT') {
        return [result.rows, result.fields];
    }

    return [normalizeResult(result), result.fields];
};

const escapeId = identifier => {
    if (typeof identifier !== 'string' || identifier.length === 0 || identifier.length > 128 || identifier.includes('\0')) {
        throw new Error('Invalid SQL identifier');
    }
    return `"${identifier.replace(/"/g, '""')}"`;
};

const wrapClient = client => ({
    query: async (sql, values = []) => {
        const result = await client.query(normalizeSql(sql), values);
        return normalizeQueryResult(result);
    },
    escapeId,
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release()
});

const db = {
    query: async (sql, values = []) => {
        const result = await pool.query(normalizeSql(sql), values);
        return normalizeQueryResult(result);
    },
    escapeId,
    getConnection: async () => wrapClient(await pool.connect()),
    end: () => pool.end()
};

pool.on('error', error => console.error('PostgreSQL pool error:', error));

module.exports = db;
