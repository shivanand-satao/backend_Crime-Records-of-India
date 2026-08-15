const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getDatasetTableSchema,
    validateRecord,
    validateColumns,
    buildWhereClause,
    buildUpdateClause,
    getRowIdentifier
} = require('../src/services/datasetTableService');

const fakeConnection = {
    escapeId: identifier => `\`${String(identifier).replaceAll('`', '``')}\``
};

test('system tables are rejected case-insensitively without querying MySQL', async () => {
    let queryCount = 0;
    const connection = {
        query: async () => {
            queryCount += 1;
            return [[]];
        }
    };

    assert.equal(await getDatasetTableSchema(connection, 'USERS'), null);
    assert.equal(queryCount, 0);
});

test('dataset schema returns exact column names and primary keys', async () => {
    const connection = {
        query: async sql => {
            if (sql.includes('information_schema.tables')) {
                return [[{ TABLE_NAME: 'auto_theft' }]];
            }

            return [[
                { COLUMN_NAME: 'id', COLUMN_KEY: 'PRI' },
                { COLUMN_NAME: 'Area_name', COLUMN_KEY: '' }
            ]];
        }
    };
    const schema = await getDatasetTableSchema(connection, 'auto_theft');

    assert.deepEqual(schema.primaryKeyColumns, ['id']);
    assert.equal(schema.columnNames.has('Area_name'), true);
});

test('record and column validation rejects nested values and unknown columns', () => {
    assert.throws(
        () => validateRecord({ Area_name: { value: 'Delhi' } }, 'conditions'),
        /invalid value/
    );
    assert.throws(
        () => validateColumns(
            { columnNames: new Set(['Area_name']) },
            { Year: 2001 },
            'condition'
        ),
        /Unknown condition column/
    );
});

test('dynamic predicates safely quote unusual dataset columns and handle null', () => {
    const where = buildWhereClause(fakeConnection, {
        'Auto_Theft_Coordinated/Traced': 'Yes',
        Group_Name: null
    });

    assert.equal(
        where.sql,
        '`Auto_Theft_Coordinated/Traced` = ? AND `Group_Name` IS NULL'
    );
    assert.deepEqual(where.values, ['Yes']);
});

test('update clauses preserve input order and row identifiers prefer primary keys', () => {
    const update = buildUpdateClause(fakeConnection, {
        Year: 2002,
        Area_name: 'Delhi'
    });

    assert.equal(update.sql, '`Year` = ?, `Area_name` = ?');
    assert.deepEqual(update.values, [2002, 'Delhi']);
    assert.equal(
        getRowIdentifier(
            { primaryKeyColumns: ['id'] },
            { id: 42 },
            { Area_name: 'Delhi' }
        ),
        '42'
    );
});
