const test = require('node:test');
const assert = require('node:assert/strict');
const { datasetRowsKey } = require('../src/services/redisCache');

test('dataset row cache keys are stable, user-scoped, and request-specific', () => {
    const first = datasetRowsKey('user:7', 'auto_theft', 'search', {
        filters: { Year: 2001, Area_name: 'Delhi' },
        page: 1,
        limit: 20
    });
    const reordered = datasetRowsKey('user:7', 'auto_theft', 'search', {
        limit: 20,
        page: 1,
        filters: { Area_name: 'Delhi', Year: 2001 }
    });

    assert.equal(first, reordered);
    assert.notEqual(
        first,
        datasetRowsKey('user:8', 'auto_theft', 'search', {
            filters: { Year: 2001, Area_name: 'Delhi' },
            page: 1,
            limit: 20
        })
    );
    assert.notEqual(
        first,
        datasetRowsKey('user:7', 'auto_theft', 'search', {
            filters: { Year: 2002, Area_name: 'Delhi' },
            page: 1,
            limit: 20
        })
    );
});
