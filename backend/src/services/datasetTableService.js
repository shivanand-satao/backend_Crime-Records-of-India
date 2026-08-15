const SYSTEM_TABLES = new Set([
    'admins',
    'users',
    'refresh_tokens',
    'user_settings',
    'notifications',
    'dataset_metadata',
    'dataset_columns',
    'views_log',
    'search_logs',
    'admin_modification_logs',
    'response',
    'api_request_logs',
    'upload_history'
]);

const isPlainObject = value => (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
);

const isScalarValue = value => (
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'boolean'
);

const getDatasetTableSchema = async (connection, tableName) => {
    if (typeof tableName !== 'string' || tableName.length === 0 || tableName.length > 128) {
        return null;
    }

    if (SYSTEM_TABLES.has(tableName.toLowerCase())) {
        return null;
    }

    const [tables] = await connection.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ?
        AND table_name = ?
        AND table_type = 'BASE TABLE'
        `,
        [process.env.DB_NAME, tableName]
    );

    if (tables.length === 0) {
        return null;
    }

    const resolvedTableName = tables[0].TABLE_NAME || tables[0].table_name;

    if (SYSTEM_TABLES.has(String(resolvedTableName).toLowerCase())) {
        return null;
    }

    const [columns] = await connection.query(
        `
        SELECT
            COLUMN_NAME,
            DATA_TYPE,
            COLUMN_TYPE,
            IS_NULLABLE,
            COLUMN_KEY,
            EXTRA
        FROM information_schema.columns
        WHERE table_schema = ?
        AND table_name = ?
        ORDER BY ordinal_position
        `,
        [process.env.DB_NAME, tableName]
    );

    return {
        tableName,
        columns,
        columnNames: new Set(columns.map(column => column.COLUMN_NAME)),
        primaryKeyColumns: columns
            .filter(column => column.COLUMN_KEY === 'PRI')
            .map(column => column.COLUMN_NAME)
    };
};

const validateRecord = (record, label) => {
    if (!isPlainObject(record) || Object.keys(record).length === 0) {
        const error = new Error(`${label} must be a non-empty object`);
        error.statusCode = 400;
        throw error;
    }

    for (const [key, value] of Object.entries(record)) {
        if (typeof key !== 'string' || key.length === 0 || !isScalarValue(value)) {
            const error = new Error(`${label} contains an invalid value`);
            error.statusCode = 400;
            throw error;
        }
    }
};

const validateColumns = (schema, record, label) => {
    const invalidColumns = Object.keys(record)
        .filter(column => !schema.columnNames.has(column));

    if (invalidColumns.length > 0) {
        const error = new Error(
            `Unknown ${label} column(s): ${invalidColumns.join(', ')}`
        );
        error.statusCode = 400;
        throw error;
    }
};

const buildWhereClause = (connection, conditions) => {
    const clauses = [];
    const values = [];

    for (const [column, value] of Object.entries(conditions)) {
        if (value === null) {
            clauses.push(`${connection.escapeId(column)} IS NULL`);
        } else {
            clauses.push(`${connection.escapeId(column)} = ?`);
            values.push(value);
        }
    }

    return {
        sql: clauses.join(' AND '),
        values
    };
};

const buildUpdateClause = (connection, updateData) => {
    const keys = Object.keys(updateData);

    return {
        sql: keys
            .map(column => `${connection.escapeId(column)} = ?`)
            .join(', '),
        values: keys.map(column => updateData[column]),
        keys
    };
};

const getRowIdentifier = (schema, row, conditions) => {
    if (schema.primaryKeyColumns.length > 0) {
        const primaryKeyValues = schema.primaryKeyColumns
            .map(column => row[column]);

        if (primaryKeyValues.every(value => value !== undefined && value !== null)) {
            return primaryKeyValues.join('|').slice(0, 100);
        }
    }

    return JSON.stringify(conditions).slice(0, 100);
};

module.exports = {
    SYSTEM_TABLES,
    isPlainObject,
    getDatasetTableSchema,
    validateRecord,
    validateColumns,
    buildWhereClause,
    buildUpdateClause,
    getRowIdentifier
};
