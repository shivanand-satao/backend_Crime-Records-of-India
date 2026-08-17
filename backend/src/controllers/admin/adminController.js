const pool = require('../../config/db');
const {
    getDatasetTableSchema,
    validateRecord,
    validateColumns,
    buildWhereClause,
    buildUpdateClause
} = require('../../services/datasetTableService');

const MAX_AUDIT_PAGE_SIZE = 100;
const MAX_ADMIN_PAGE_SIZE = 100;
const AUDIT_ACTIONS = new Set(['INSERT', 'UPDATE', 'DELETE']);
const USER_STATUSES = new Set(['active', 'inactive', 'banned']);
const CLIENT_INPUT_DB_ERRORS = new Set([
    'ER_BAD_NULL_ERROR',
    'ER_DATA_TOO_LONG',
    'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD',
    'ER_WARN_DATA_OUT_OF_RANGE',
    'WARN_DATA_TRUNCATED',
    '23502',
    '22001',
    '22P02',
    '22003'
]);

const rollbackQuietly = async connection => {
    if (!connection) {
        return;
    }

    try {
        await connection.rollback();
    } catch (error) {
        console.error('Transaction rollback failed:', error);
    }
};

const sendControllerError = (res, error, fallbackMessage) => {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
    }

    if (CLIENT_INPUT_DB_ERRORS.has(error.code)) {
        return res.status(400).json({
            success: false,
            message: 'One or more values are invalid for the selected columns'
        });
    }

    console.error(error);

    return res.status(500).json({
        success: false,
        message: fallbackMessage
    });
};

const setAuditContext = async (connection, req) => {
    await connection.query(
        `
        SELECT
            set_config('app.audit_enabled', ?, true),
            set_config('app.admin_id', ?, true),
            set_config('app.admin_username', ?, true),
            set_config('app.ip_address', ?, true)
        `,
        [
            'on',
            String(req.user.id),
            req.user.username || '',
            req.ip || req.socket?.remoteAddress || ''
        ]
    );
};

const getTriggerAuditLogId = async connection => {
    const [rows] = await connection.query(
        `
        SELECT NULLIF(
            current_setting('app.audit_log_id', true),
            ''
        ) AS audit_log_id
        `
    );

    const auditLogId = rows[0]?.audit_log_id;
    return auditLogId === null || auditLogId === undefined
        ? null
        : Number(auditLogId);
};

const getSingleSelectedRow = async ({
    connection,
    table,
    row
}) => {
    const tableIdentifier = connection.escapeId(table);
    const where = buildWhereClause(connection, row);
    const [rows] = await connection.query(
        `SELECT * FROM ${tableIdentifier} WHERE ${where.sql} FOR UPDATE`,
        where.values
    );

    if (rows.length === 0) {
        const error = new Error('Selected row was not found');
        error.statusCode = 404;
        throw error;
    }

    if (rows.length > 1) {
        const error = new Error(
            'The row selector matched multiple rows. Send more current column values.'
        );
        error.statusCode = 409;
        throw error;
    }

    return {
        tableIdentifier,
        where,
        row: rows[0]
    };
};

const validateSelectedRowRequest = async (connection, table, row) => {
    validateRecord(row, 'row');

    const schema = await getDatasetTableSchema(connection, table);

    if (!schema) {
        const error = new Error('Dataset table not found');
        error.statusCode = 404;
        throw error;
    }

    validateColumns(schema, row, 'row');
    return schema;
};

// Update one cell in exactly one selected dataset row.
const updateTableCell = async (req, res) => {
    let connection;

    try {
        const { table } = req.params;
        const body = req.body || {};
        const row = body.row;

        if (typeof body.column !== 'string' || body.column.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'column is required'
            });
        }

        if (!Object.prototype.hasOwnProperty.call(body, 'value')) {
            return res.status(400).json({
                success: false,
                message: 'value is required'
            });
        }

        validateRecord(row, 'row');
        validateRecord({ [body.column]: body.value }, 'cell update');

        connection = await pool.getConnection();
        await connection.beginTransaction();
        await setAuditContext(connection, req);

        const schema = await validateSelectedRowRequest(connection, table, row);
        validateColumns(schema, { [body.column]: body.value }, 'update');

        const selected = await getSingleSelectedRow({
            connection,
            table,
            row
        });
        const update = buildUpdateClause(connection, {
            [body.column]: body.value
        });
        const [result] = await connection.query(
            `
            UPDATE ${selected.tableIdentifier}
            SET ${update.sql}
            WHERE ${selected.where.sql}
              AND ${connection.escapeId(body.column)} IS DISTINCT FROM ?
            `,
            [...update.values, ...selected.where.values, body.value]
        );

        if ((result.changedRows ?? 0) === 0) {
            await connection.rollback();

            return res.status(200).json({
                success: true,
                changed: false,
                message: 'Cell already contains the requested value',
                table,
                column: body.column,
                row: selected.row,
                auditLogId: null
            });
        }

        const updatedRow = {
            ...selected.row,
            [body.column]: body.value
        };
        const auditLogId = await getTriggerAuditLogId(connection);

        await connection.commit();

        return res.status(200).json({
            success: true,
            changed: true,
            message: 'Cell updated successfully',
            table,
            column: body.column,
            oldValue: selected.row[body.column],
            newValue: body.value,
            row: updatedRow,
            auditLogId
        });
    } catch (error) {
        await rollbackQuietly(connection);
        return sendControllerError(res, error, 'Failed to update cell');
    } finally {
        connection?.release();
    }
};

// Delete exactly one selected dataset row.
const deleteTableRow = async (req, res) => {
    let connection;

    try {
        const { table } = req.params;
        const body = req.body || {};
        const row = body.row;

        validateRecord(row, 'row');

        connection = await pool.getConnection();
        await connection.beginTransaction();
        await setAuditContext(connection, req);

        await validateSelectedRowRequest(connection, table, row);
        const selected = await getSingleSelectedRow({
            connection,
            table,
            row
        });
        const [result] = await connection.query(
            `DELETE FROM ${selected.tableIdentifier} WHERE ${selected.where.sql}`,
            selected.where.values
        );
        const auditLogId = await getTriggerAuditLogId(connection);

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: 'Row deleted successfully',
            table,
            deletedRows: result.affectedRows,
            deletedRow: selected.row,
            auditLogId
        });
    } catch (error) {
        await rollbackQuietly(connection);
        return sendControllerError(res, error, 'Failed to delete row');
    } finally {
        connection?.release();
    }
};

const parsePositiveInteger = (value, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
    if (value === undefined) {
        return fallback;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
        const error = new Error('Values must be positive integers');
        error.statusCode = 400;
        throw error;
    }

    return parsed;
};

const normalizeOptionalText = (value, fieldName, maximumLength) => {
    if (value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        const error = new Error(`${fieldName} must be a string`);
        error.statusCode = 400;
        throw error;
    }

    const normalized = value.trim();

    if (normalized.length > maximumLength) {
        const error = new Error(
            `${fieldName} must not exceed ${maximumLength} characters`
        );
        error.statusCode = 400;
        throw error;
    }

    return normalized || null;
};

const normalizeSearchLog = log => {
    if (typeof log.search_filters === 'string') {
        try {
            log.search_filters = JSON.parse(log.search_filters);
        } catch (error) {
            // Preserve legacy text if an older search log is not valid JSON.
        }
    }

    return log;
};

const getAdminUsers = async (req, res) => {
    try {
        const page = parsePositiveInteger(req.query.page, 1);
        const limit = parsePositiveInteger(
            req.query.limit,
            20,
            MAX_ADMIN_PAGE_SIZE
        );
        const offset = (page - 1) * limit;
        const search = normalizeOptionalText(req.query.search, 'search', 100);
        const status = normalizeOptionalText(req.query.status, 'status', 20);
        const clauses = [];
        const values = [];

        if (status && !USER_STATUSES.has(status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'status must be active, inactive, or banned'
            });
        }

        if (search) {
            clauses.push(`
                (
                    username LIKE ('%' || ? || '%')
                    OR full_name LIKE ('%' || ? || '%')
                    OR email LIKE ('%' || ? || '%')
                    OR department LIKE ('%' || ? || '%')
                )
            `);
            values.push(search, search, search, search);
        }

        if (status) {
            clauses.push('status = ?');
            values.push(status.toLowerCase());
        }

        const whereSql = clauses.length > 0
            ? `WHERE ${clauses.join(' AND ')}`
            : '';
        const [summaryResult, countResult, usersResult] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*) AS totalUsers,
                    COUNT(*) FILTER (WHERE status = 'active') AS activeAccounts,
                    COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '7 days') AS activeInLast7Days,
                    COUNT(*) FILTER (WHERE status = 'inactive') AS inactiveAccounts
                FROM users
            `),
            pool.query(
                `SELECT COUNT(*) AS total FROM users ${whereSql}`,
                values
            ),
            pool.query(
                `
                SELECT
                    id,
                    username,
                    email,
                    full_name,
                    department,
                    status,
                    last_login,
                    created_at,
                    updated_at
                FROM users
                ${whereSql}
                ORDER BY created_at DESC, id DESC
                LIMIT ? OFFSET ?
                `,
                [...values, limit, offset]
            )
        ]);
        const summaryRow = summaryResult[0][0];
        const totalRecords = Number(countResult[0][0].total);

        return res.status(200).json({
            success: true,
            summary: {
                totalUsers: Number(summaryRow.totalUsers),
                activeAccounts: Number(summaryRow.activeAccounts),
                activeInLast7Days: Number(summaryRow.activeInLast7Days),
                inactiveAccounts: Number(summaryRow.inactiveAccounts)
            },
            page,
            limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            data: usersResult[0]
        });
    } catch (error) {
        return sendControllerError(res, error, 'Failed to fetch users');
    }
};

const getAdminSearchLogs = async (req, res) => {
    try {
        const page = parsePositiveInteger(req.query.page, 1);
        const limit = parsePositiveInteger(
            req.query.limit,
            20,
            MAX_ADMIN_PAGE_SIZE
        );
        const offset = (page - 1) * limit;
        const username = normalizeOptionalText(
            req.query.username ?? req.query.search,
            'username',
            50
        );
        const dataset = normalizeOptionalText(
            req.query.dataset ?? req.query.tableName ?? req.query.table,
            'dataset',
            100
        );
        const clauses = [];
        const values = [];

        if (username) {
            clauses.push("username LIKE ('%' || ? || '%')");
            values.push(username);
        }

        if (dataset) {
            clauses.push('table_name = ?');
            values.push(dataset);
        }

        const whereSql = clauses.length > 0
            ? `WHERE ${clauses.join(' AND ')}`
            : '';
        const [
            totalSearchesResult,
            keywordResult,
            trendingDatasetResult,
            datasetsResult,
            countResult,
            logsResult
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) AS totalSearches FROM search_logs'),
            pool.query(`
                SELECT /* JSON_TABLE compatibility */
                    filter_values.value AS keyword,
                    COUNT(*) AS total
                FROM search_logs
                CROSS JOIN LATERAL jsonb_each_text(
                    CASE
                        WHEN search_logs.search_filters IS NULL THEN '{}'::jsonb
                        ELSE search_logs.search_filters::jsonb
                    END
                ) AS filter_values(keyword, value)
                WHERE filter_values.value IS NOT NULL
                    AND TRIM(filter_values.value) <> ''
                GROUP BY filter_values.value
                ORDER BY total DESC, filter_values.value ASC
                LIMIT 1
            `),
            pool.query(`
                SELECT table_name AS dataset, COUNT(*) AS total
                FROM search_logs
                WHERE table_name IS NOT NULL AND table_name <> ''
                GROUP BY table_name
                ORDER BY total DESC, table_name ASC
                LIMIT 1
            `),
            pool.query(`
                SELECT DISTINCT table_name AS dataset
                FROM search_logs
                WHERE table_name IS NOT NULL AND table_name <> ''
                ORDER BY table_name ASC
            `),
            pool.query(
                `SELECT COUNT(*) AS total FROM search_logs ${whereSql}`,
                values
            ),
            pool.query(
                `
                SELECT
                    id,
                    user_id,
                    username,
                    table_name,
                    search_filters,
                    result_count,
                    user_ip,
                    status,
                    created_at
                FROM search_logs
                ${whereSql}
                ORDER BY created_at DESC, id DESC
                LIMIT ? OFFSET ?
                `,
                [...values, limit, offset]
            )
        ]);
        const totalRecords = Number(countResult[0][0].total);
        const mostSearchedKeyword = keywordResult[0][0] || null;
        const trendingDataset = trendingDatasetResult[0][0] || null;

        return res.status(200).json({
            success: true,
            summary: {
                totalSearches: Number(totalSearchesResult[0][0].totalSearches),
                mostSearchedKeyword: mostSearchedKeyword
                    ? {
                        keyword: mostSearchedKeyword.keyword,
                        total: Number(mostSearchedKeyword.total)
                    }
                    : null,
                trendingDataset: trendingDataset
                    ? {
                        dataset: trendingDataset.dataset,
                        total: Number(trendingDataset.total)
                    }
                    : null
            },
            datasets: datasetsResult[0].map(row => row.dataset),
            page,
            limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            data: logsResult[0].map(normalizeSearchLog)
        });
    } catch (error) {
        return sendControllerError(res, error, 'Failed to fetch search logs');
    }
};

const normalizeAuditDate = (value, endOfDay = false) => {
    if (value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        const error = new Error('Audit date filters must be valid ISO dates');
        error.statusCode = 400;
        throw error;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsed = new Date(`${value}T00:00:00.000Z`);

        if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)) {
            return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`;
        }

        const error = new Error('Audit date filters must be valid ISO dates');
        error.statusCode = 400;
        throw error;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        const error = new Error('Audit date filters must be valid ISO dates');
        error.statusCode = 400;
        throw error;
    }

    return parsed.toISOString().slice(0, 19).replace('T', ' ');
};

const normalizeAuditLog = log => {
    for (const field of ['old_data', 'new_data', 'changed_columns']) {
        if (typeof log[field] === 'string') {
            try {
                log[field] = JSON.parse(log[field]);
            } catch (error) {
                // Preserve legacy text if an older audit row is not valid JSON.
            }
        }
    }

    return log;
};

const getAuditLogs = async (req, res) => {
    try {
        const page = parsePositiveInteger(req.query.page, 1);
        const limit = parsePositiveInteger(req.query.limit, 20, MAX_AUDIT_PAGE_SIZE);
        const offset = (page - 1) * limit;
        const clauses = [];
        const values = [];
        const tableName = req.query.tableName || req.query.table;

        if (tableName) {
            if (typeof tableName !== 'string' || tableName.length > 128) {
                return res.status(400).json({
                    success: false,
                    message: 'tableName must be a valid table name'
                });
            }

            clauses.push('table_name = ?');
            values.push(tableName);
        }

        if (req.query.action) {
            const action = String(req.query.action).toUpperCase();

            if (!AUDIT_ACTIONS.has(action)) {
                return res.status(400).json({
                    success: false,
                    message: 'action must be INSERT, UPDATE, or DELETE'
                });
            }

            clauses.push('action_type = ?');
            values.push(action);
        }

        if (req.query.adminId !== undefined) {
            clauses.push('admin_id = ?');
            values.push(parsePositiveInteger(req.query.adminId));
        }

        const from = normalizeAuditDate(req.query.from);
        const to = normalizeAuditDate(req.query.to, true);

        if (from && to && from > to) {
            return res.status(400).json({
                success: false,
                message: 'from must be earlier than or equal to to'
            });
        }

        if (from) {
            clauses.push('created_at >= ?');
            values.push(from);
        }

        if (to) {
            clauses.push('created_at <= ?');
            values.push(to);
        }

        const whereSql = clauses.length > 0
            ? `WHERE ${clauses.join(' AND ')}`
            : '';
        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM admin_modification_logs ${whereSql}`,
            values
        );
        const [logs] = await pool.query(
            `
            SELECT
                id,
                admin_id,
                admin_username,
                table_name,
                row_id,
                action_type,
                old_data,
                new_data,
                changed_columns,
                ip_address,
                created_at
            FROM admin_modification_logs
            ${whereSql}
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
            `,
            [...values, limit, offset]
        );
        const totalRecords = Number(countRows[0].total);

        return res.status(200).json({
            success: true,
            page,
            limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            data: logs.map(normalizeAuditLog)
        });
    } catch (error) {
        return sendControllerError(res, error, 'Failed to fetch audit logs');
    }
};

const getAuditLogById = async (req, res) => {
    try {
        const auditLogId = parsePositiveInteger(req.params.id);
        const [logs] = await pool.query(
            `
            SELECT
                id,
                admin_id,
                admin_username,
                table_name,
                row_id,
                action_type,
                old_data,
                new_data,
                changed_columns,
                ip_address,
                created_at
            FROM admin_modification_logs
            WHERE id = ?
            `,
            [auditLogId]
        );

        if (logs.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Audit log not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: normalizeAuditLog(logs[0])
        });
    } catch (error) {
        return sendControllerError(res, error, 'Failed to fetch audit log');
    }
};

module.exports = {
    getAdminUsers,
    getAdminSearchLogs,
    updateTableCell,
    deleteTableRow,
    getAuditLogs,
    getAuditLogById
};
