const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/config/db');
const redisCache = require('../src/services/redisCache');
const {
    updateTableCell,
    deleteTableRow
} = require('../src/controllers/admin/adminController');

const originalGetConnection = pool.getConnection;
const originalInvalidateDatasetTable = redisCache.invalidateDatasetTable;

const invoke = async (handler, req) => {
    let response;
    const res = {
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            response = { statusCode: this.statusCode, body };
            return response;
        }
    };

    await handler(req, res);
    return response;
};

const createConnection = mutation => {
    const queries = [];
    const connection = {
        escapeId: identifier => `"${String(identifier).replaceAll('"', '""')}"`,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        query: async (sql, values = []) => {
            const normalizedSql = sql.replace(/\s+/g, ' ').trim();
            queries.push({ sql: normalizedSql, values });

            if (normalizedSql.includes("set_config('app.audit_enabled'")) {
                return [[{}], []];
            }

            if (normalizedSql.includes('information_schema.tables')) {
                return [[{ table_name: 'auto_theft' }], []];
            }

            if (normalizedSql.includes('information_schema.columns')) {
                return [[
                    { COLUMN_NAME: 'id', COLUMN_KEY: 'PRI' },
                    { COLUMN_NAME: 'Year', COLUMN_KEY: '' }
                ], []];
            }

            if (normalizedSql.startsWith('SELECT * FROM')) {
                return [[{ id: 1, Year: 2001 }], []];
            }

            if (normalizedSql.startsWith(mutation)) {
                return [{ changedRows: 1, affectedRows: 1 }, []];
            }

            if (normalizedSql.includes("current_setting('app.audit_log_id'")) {
                return [[{ audit_log_id: '42' }], []];
            }

            throw new Error(`Unexpected query: ${normalizedSql}`);
        }
    };

    return { connection, queries };
};

test.afterEach(() => {
    pool.getConnection = originalGetConnection;
    redisCache.invalidateDatasetTable = originalInvalidateDatasetTable;
});

test('admin update delegates auditing to the database trigger', async () => {
    const { connection, queries } = createConnection('UPDATE');
    pool.getConnection = async () => connection;
    const invalidatedTables = [];
    redisCache.invalidateDatasetTable = async table => invalidatedTables.push(table);

    const response = await invoke(updateTableCell, {
        params: { table: 'auto_theft' },
        body: { row: { id: 1 }, column: 'Year', value: 2002 },
        user: { id: 7, username: 'admin' },
        ip: '127.0.0.1'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.auditLogId, 42);
    assert.equal(response.body.changed, true);
    assert.equal(
        queries.some(query => query.sql.includes('INSERT INTO admin_modification_logs')),
        false
    );

    const contextIndex = queries.findIndex(query => query.sql.includes('app.audit_enabled'));
    const updateIndex = queries.findIndex(query => query.sql.startsWith('UPDATE'));
    assert.ok(contextIndex >= 0 && contextIndex < updateIndex);
    assert.match(queries[updateIndex].sql, /IS DISTINCT FROM \?/);
    assert.deepEqual(queries[updateIndex].values, [2002, 1, 2002]);
    assert.deepEqual(invalidatedTables, ['auto_theft']);
});

test('admin delete returns the audit ID created by the trigger', async () => {
    const { connection, queries } = createConnection('DELETE');
    pool.getConnection = async () => connection;
    const invalidatedTables = [];
    redisCache.invalidateDatasetTable = async table => invalidatedTables.push(table);

    const response = await invoke(deleteTableRow, {
        params: { table: 'auto_theft' },
        body: { row: { id: 1 } },
        user: { id: 7, username: 'admin' },
        ip: '127.0.0.1'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.auditLogId, 42);
    assert.equal(response.body.deletedRows, 1);
    assert.equal(
        queries.some(query => query.sql.includes('INSERT INTO admin_modification_logs')),
        false
    );
    assert.deepEqual(invalidatedTables, ['auto_theft']);
});
