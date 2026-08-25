const test = require('node:test');
const assert = require('node:assert/strict');
const { datasetRowsKey } = require('../src/services/redisCache');

test('dataset row cache keys are shared and request-specific', () => {
    const first = datasetRowsKey('auto_theft', 'search', {
        filters: { Year: 2001, Area_name: 'Delhi' },
        page: 1,
        limit: 20
    });
    const reordered = datasetRowsKey('auto_theft', 'search', {
        limit: 20,
        page: 1,
        filters: { Area_name: 'Delhi', Year: 2001 }
    });

    assert.equal(first, reordered);
    assert.match(first, /^dataset:rows:auto_theft:search:[a-f0-9]{64}$/);
    assert.notEqual(
        first,
        datasetRowsKey('auto_theft', 'search', {
            filters: { Year: 2002, Area_name: 'Delhi' },
            page: 1,
            limit: 20
        })
    );
});
