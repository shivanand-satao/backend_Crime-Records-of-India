const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/config/db');
const {
    getAdminUsers,
    getAdminSearchLogs
} = require('../src/controllers/admin/adminController');

const originalQuery = pool.query;

const invoke = async (handler, query = {}) => {
    let response;
    const res = {
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            response = {
                statusCode: this.statusCode,
                body
            };
            return response;
        }
    };

    await handler({ query }, res);
    return response;
};

test.afterEach(() => {
    pool.query = originalQuery;
});

test('admin users returns dashboard totals and public paginated fields', async () => {
    const queries = [];

    pool.query = async (sql, values = []) => {
        const normalizedSql = sql.replace(/\s+/g, ' ').trim();
        queries.push({ sql: normalizedSql, values });

        if (normalizedSql.includes('COUNT(*) AS totalUsers')) {
            return [[{
                totalUsers: '12',
                activeAccounts: '8',
                activeInLast7Days: '4',
                inactiveAccounts: '3'
            }], []];
        }

        if (normalizedSql.startsWith('SELECT COUNT(*) AS total FROM users')) {
            return [[{ total: '1' }], []];
        }

        return [[{
            id: 7,
            username: 'analyst',
            email: 'analyst@example.com',
            full_name: 'Crime Analyst',
            department: 'Analysis',
            status: 'active',
            last_login: null,
            created_at: new Date('2026-08-15T00:00:00Z'),
            updated_at: new Date('2026-08-15T00:00:00Z')
        }], []];
    };

    const response = await invoke(getAdminUsers, {
        page: '2',
        limit: '5',
        search: 'analyst',
        status: 'ACTIVE'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.summary, {
        totalUsers: 12,
        activeAccounts: 8,
        activeInLast7Days: 4,
        inactiveAccounts: 3
    });
    assert.equal(response.body.page, 2);
    assert.equal(response.body.limit, 5);
    assert.equal(response.body.totalRecords, 1);
    assert.equal(response.body.totalPages, 1);
    assert.equal(response.body.data[0].password_hash, undefined);

    const listQuery = queries.find(query => query.sql.includes('ORDER BY created_at'));
    assert.deepEqual(
        listQuery.values,
        ['analyst', 'analyst', 'analyst', 'analyst', 'active', 5, 5]
    );
});

test('admin users rejects an unsupported status before querying MySQL', async () => {
    let queryCount = 0;
    pool.query = async () => {
        queryCount += 1;
        return [[], []];
    };

    const response = await invoke(getAdminUsers, { status: 'suspended' });

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.success, false);
    assert.match(response.body.message, /active, inactive, or banned/);
    assert.equal(queryCount, 0);
});

test('admin search logs returns summaries, dataset options, and parsed filters', async () => {
    const queries = [];

    pool.query = async (sql, values = []) => {
        const normalizedSql = sql.replace(/\s+/g, ' ').trim();
        queries.push({ sql: normalizedSql, values });

        if (normalizedSql.includes('COUNT(*) AS totalSearches')) {
            return [[{ totalSearches: '21' }], []];
        }

        if (normalizedSql.includes('JSON_TABLE')) {
            return [[{ keyword: 'Delhi', total: '7' }], []];
        }

        if (normalizedSql.includes('table_name AS dataset, COUNT(*) AS total')) {
            return [[{ dataset: 'auto_theft', total: '9' }], []];
        }

        if (normalizedSql.includes('SELECT DISTINCT table_name AS dataset')) {
            return [[
                { dataset: 'auto_theft' },
                { dataset: 'victims_of_rape' }
            ], []];
        }

        if (normalizedSql.startsWith('SELECT COUNT(*) AS total FROM search_logs')) {
            return [[{ total: '1' }], []];
        }

        return [[{
            id: 10,
            user_id: 7,
            username: 'analyst',
            table_name: 'auto_theft',
            search_filters: '{"Area_name":"Delhi","Year":2001}',
            result_count: 4,
            user_ip: '127.0.0.1',
            status: 'success',
            created_at: new Date('2026-08-15T00:00:00Z')
        }], []];
    };

    const response = await invoke(getAdminSearchLogs, {
        username: 'analyst',
        dataset: 'auto_theft',
        page: '1',
        limit: '10'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.summary, {
        totalSearches: 21,
        mostSearchedKeyword: { keyword: 'Delhi', total: 7 },
        trendingDataset: { dataset: 'auto_theft', total: 9 }
    });
    assert.deepEqual(response.body.datasets, [
        'auto_theft',
        'victims_of_rape'
    ]);
    assert.deepEqual(response.body.data[0].search_filters, {
        Area_name: 'Delhi',
        Year: 2001
    });

    const listQuery = queries.find(query => query.sql.includes('ORDER BY created_at'));
    assert.deepEqual(listQuery.values, ['analyst', 'auto_theft', 10, 0]);
});
