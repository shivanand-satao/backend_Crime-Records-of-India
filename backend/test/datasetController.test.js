const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/db');
const redisCache = require('../src/services/redisCache');
const {
    enforcePageSize,
    isValidCachedPage,
    parsePagination,
    searchTableData
} = require('../src/controllers/datasets/datasetController');

test('page-size guard prevents oversized database results from reaching Redis', () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({ id: index + 1 }));
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
        assert.equal(enforcePageSize(rows, 20).length, 20);
    } finally {
        console.warn = originalWarn;
    }
});

test('oversized cached pages are rejected instead of being served', () => {
    assert.equal(
        isValidCachedPage({ data: Array.from({ length: 20 }) }, 20),
        true
    );
    assert.equal(
        isValidCachedPage({ data: Array.from({ length: 500 }) }, 20),
        false
    );
});

test('pagination starts at the first row and advances by the requested page size', () => {
    assert.deepEqual(parsePagination({ page: 1, limit: 20 }), {
        page: 1,
        limit: 20,
        offset: 0
    });

    assert.deepEqual(parsePagination({ page: 3, limit: 10 }), {
        page: 3,
        limit: 10,
        offset: 20
    });
});

test('pagination rejects a page size that could create an oversized cache entry', () => {
    assert.throws(
        () => parsePagination({ page: 1, limit: 101 }),
        /limit must be between 1 and 100/
    );
});


test('server-side filtered search caches only the requested page', async () => {
    const originalQuery = pool.query;
    const originalGet = redisCache.get;
    const originalSet = redisCache.set;
    const originalDatasetRowsKey = redisCache.datasetRowsKey;
    const queries = [];
    const cacheInputs = [];

    pool.query = async (sql, values = []) => {
        queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });

        if (sql.includes('information_schema.tables')) {
            return [[{ table_name: 'auto_theft' }], []];
        }

        if (sql.includes('information_schema.columns')) {
            return [[
                { COLUMN_NAME: 'Area_name', DATA_TYPE: 'text', IS_NULLABLE: 'YES', COLUMN_KEY: '' },
                { COLUMN_NAME: 'Year', DATA_TYPE: 'integer', IS_NULLABLE: 'YES', COLUMN_KEY: '' }
            ], []];
        }

        if (sql.includes('COUNT(*) AS total')) {
            return [[{ total: '12' }], []];
        }

        if (sql.includes('INSERT INTO search_logs')) {
            return [{ affectedRows: 1 }, []];
        }

        return [[{ Area_name: 'Delhi', Year: 2001 }], []];
    };
    redisCache.get = async () => null;
    redisCache.set = async (key, value, ttl) => {
        cacheInputs.push({ key, value: JSON.parse(value), ttl });
        return 'OK';
    };
    redisCache.datasetRowsKey = (table, endpoint, input) => {
        cacheInputs.push({ table, endpoint, input });
        return 'test-search-cache-key';
    };

    const response = await new Promise(async resolve => {
        const res = {
            status(statusCode) {
                this.statusCode = statusCode;
                return this;
            },
            json(body) {
                resolve({ statusCode: this.statusCode, body });
            }
        };

        await searchTableData({
            params: { table: 'auto_theft' },
            query: {},
            body: {
                filters: { Area_name: 'Delhi', Year: 2001 },
                page: 2,
                limit: 10
            },
            user: { id: 7, username: 'analyst' },
            ip: '127.0.0.1'
        }, res);
    });

    try {
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.data.length, 1);
        assert.equal(response.body.page, 2);
        assert.equal(response.body.limit, 10);
        assert.equal(response.body.searchTerm, '');

        const cacheKeyInput = cacheInputs.find(entry => entry.input)?.input;
        assert.deepEqual(cacheKeyInput, {
            filters: { Area_name: 'Delhi', Year: 2001 },
            searchTerm: '',
            sortBy: null,
            sortOrder: 'ASC',
            page: 2,
            limit: 10
        });

        const selectQuery = queries.find(query => query.sql.startsWith('SELECT * FROM'));
        assert.match(selectQuery.sql, /WHERE "Area_name" = \? AND "Year" = \?/);
        assert.deepEqual(selectQuery.values, ['Delhi', 2001, 10, 10]);
        assert.equal(cacheInputs.find(entry => entry.value)?.value.data.length, 1);
    } finally {
        pool.query = originalQuery;
        redisCache.get = originalGet;
        redisCache.set = originalSet;
        redisCache.datasetRowsKey = originalDatasetRowsKey;
    }
});

test('server-side text search is paginated instead of loading every table page', async () => {
    const originalQuery = pool.query;
    const originalGet = redisCache.get;
    const originalSet = redisCache.set;
    const originalDatasetRowsKey = redisCache.datasetRowsKey;
    const queries = [];

    pool.query = async (sql, values = []) => {
        queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });

        if (sql.includes('information_schema.tables')) {
            return [[{ table_name: 'auto_theft' }], []];
        }

        if (sql.includes('information_schema.columns')) {
            return [[
                { COLUMN_NAME: 'Area_name', DATA_TYPE: 'text', IS_NULLABLE: 'YES', COLUMN_KEY: '' },
                { COLUMN_NAME: 'Year', DATA_TYPE: 'integer', IS_NULLABLE: 'YES', COLUMN_KEY: '' }
            ], []];
        }

        if (sql.includes('COUNT(*) AS total')) {
            return [[{ total: '2' }], []];
        }

        if (sql.includes('INSERT INTO search_logs')) {
            return [{ affectedRows: 1 }, []];
        }

        return [[{ Area_name: 'Delhi', Year: 2001 }], []];
    };
    redisCache.get = async () => null;
    redisCache.set = async () => 'OK';
    redisCache.datasetRowsKey = (table, endpoint, input) => {
        assert.equal(endpoint, 'search');
        assert.equal(input.searchTerm, 'Delhi');
        return 'test-text-search-cache-key';
    };

    const response = await new Promise(async resolve => {
        const res = {
            status(statusCode) {
                this.statusCode = statusCode;
                return this;
            },
            json(body) {
                resolve({ statusCode: this.statusCode, body });
            }
        };

        await searchTableData({
            params: { table: 'auto_theft' },
            query: {},
            body: { searchTerm: 'Delhi', page: 1, limit: 10 },
            user: { id: 7, username: 'analyst' },
            ip: '127.0.0.1'
        }, res);
    });

    try {
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.searchTerm, 'Delhi');
        const selectQuery = queries.find(query => query.sql.startsWith('SELECT * FROM'));
        assert.match(selectQuery.sql, /CAST\("Area_name" AS TEXT\) ILIKE \?/);
        assert.match(selectQuery.sql, /CAST\("Year" AS TEXT\) ILIKE \?/);
        assert.equal(selectQuery.values.length, 4);
        assert.deepEqual(selectQuery.values.slice(-2), [10, 0]);
    } finally {
        pool.query = originalQuery;
        redisCache.get = originalGet;
        redisCache.set = originalSet;
        redisCache.datasetRowsKey = originalDatasetRowsKey;
    }
});
