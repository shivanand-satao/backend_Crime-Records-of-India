const test = require('node:test');
const assert = require('node:assert/strict');
const {
    enforcePageSize,
    parsePagination
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
