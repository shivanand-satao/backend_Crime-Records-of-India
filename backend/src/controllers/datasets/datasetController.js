const redisCache = require('../../services/redisCache');
const pool = require('../../config/db');
const {
    SYSTEM_TABLES,
    isPlainObject,
    getDatasetTableSchema,
    validateRecord,
    validateColumns
} = require('../../services/datasetTableService');

const MAX_PAGE_SIZE = 100;

const enforcePageSize = (rows, limit) => {
    if (!Array.isArray(rows)) return [];

    if (rows.length > limit) {
        console.warn(`[PAGINATION GUARD] database returned ${rows.length} rows for limit=${limit}; truncating response and cache payload`);
    }

    return rows.slice(0, limit);
};

const isValidCachedPage = (responseData, limit) => (
    responseData &&
    Array.isArray(responseData.data) &&
    responseData.data.length <= limit
);

const parsePagination = (query = {}) => {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    if (!Number.isInteger(page) || page < 1) {
        const error = new Error('page must be a positive integer');
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
        const error = new Error(`limit must be between 1 and ${MAX_PAGE_SIZE}`);
        error.statusCode = 400;
        throw error;
    }

    return {
        page,
        limit,
        offset: (page - 1) * limit
    };
};

const sendDatasetError = (res, error, fallbackMessage) => {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
    }

    console.error(error);

    return res.status(500).json({
        success: false,
        message: fallbackMessage
    });
};

const getAllTables = async (req, res) => {
    try {
        const cachedTables = await redisCache.get('all_tables');

        if (cachedTables) {
            console.log('[Redis HIT] GET /api/tables key=all_tables');
            return res.status(200).json(JSON.parse(cachedTables));
        }

        console.log('[DATABASE] GET /api/tables source=Supabase/PostgreSQL reason=Redis MISS');

        const excludedTables = [...SYSTEM_TABLES];
        const placeholders = excludedTables.map(() => '?').join(',');
        const [tables] = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
            AND table_type = 'BASE TABLE'
            AND table_name NOT IN (${placeholders})
            ORDER BY table_name
            `,
            [process.env.DB_SCHEMA || 'public', ...excludedTables]
        );
        const formattedTables = tables.map(table => table.TABLE_NAME || table.table_name);
        const responseData = {
            success: true,
            totalTables: formattedTables.length,
            data: formattedTables
        };

        await redisCache.set('all_tables', JSON.stringify(responseData), 1800);
        return res.status(200).json(responseData);
    } catch (error) {
        return sendDatasetError(res, error, 'Failed to fetch tables');
    }
};

const getTableSchema = async (req, res) => {
    try {
        const { table } = req.params;

        if (
            typeof table !== 'string' ||
            SYSTEM_TABLES.has(table.toLowerCase())
        ) {
            return res.status(404).json({
                success: false,
                message: 'Dataset table not found'
            });
        }

        const cacheKey = `schema_${table}`;
        const cachedSchema = await redisCache.get(cacheKey);

        if (cachedSchema) {
            console.log(`[Redis HIT] GET /api/tables/${table}/schema key=${cacheKey}`);
            return res.status(200).json(JSON.parse(cachedSchema));
        }

        console.log(`[DATABASE] GET /api/tables/${table}/schema source=Supabase/PostgreSQL reason=Redis MISS key=${cacheKey}`);

        const schema = await getDatasetTableSchema(pool, table);

        if (!schema) {
            return res.status(404).json({
                success: false,
                message: 'Dataset table not found'
            });
        }

        const responseData = {
            success: true,
            table,
            totalColumns: schema.columns.length,
            columns: schema.columns.map(column => ({
                COLUMN_NAME: column.COLUMN_NAME,
                DATA_TYPE: column.DATA_TYPE,
                IS_NULLABLE: column.IS_NULLABLE
            }))
        };

        await redisCache.set(cacheKey, JSON.stringify(responseData), 3600);
        return res.status(200).json(responseData);
    } catch (error) {
        return sendDatasetError(res, error, 'Failed to fetch schema');
    }
};

const getTableData = async (req, res) => {
    try {
        const { table } = req.params;
        const { page, limit, offset } = parsePagination(req.query);
        const schema = await getDatasetTableSchema(pool, table);

        if (!schema) {
            return res.status(404).json({
                success: false,
                message: 'Dataset table not found'
            });
        }

        const cacheKey = redisCache.datasetRowsKey(
            table,
            'list',
            { page, limit }
        );
        const cachedResponse = await redisCache.get(cacheKey);
        if (cachedResponse) {
            console.log(`[Redis HIT] GET /api/data/${table} key=${cacheKey}`);
            try {
                const responseData = JSON.parse(cachedResponse);
                if (isValidCachedPage(responseData, limit)) {
                    await pool.query(
                        `INSERT INTO views_log
                        (user_id, email, username, table_viewed, query_params, ip_address)
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [req.user.id, req.user.email || null, req.user.username, table,
                            JSON.stringify({ page, limit }), req.ip]
                    );
                    return res.status(200).json(responseData);
                }
            } catch (error) {
                console.warn(`[Redis INVALID] GET /api/data/${table} key=${cacheKey}: ${error.message}`);
            }

            console.warn(`[Redis INVALID] deleting oversized or malformed page cache key=${cacheKey}`);
            await redisCache.del(cacheKey);
        }

        console.log(`[DATABASE] GET /api/data/${table} source=Supabase/PostgreSQL reason=Redis MISS key=${cacheKey}`);

        const tableIdentifier = pool.escapeId(table);
        const [countResult] = await pool.query(
            `SELECT COUNT(*) AS total FROM ${tableIdentifier}`
        );
        const totalRecords = Number(countResult[0].total);
        const [dataRows] = await pool.query(
            `SELECT * FROM ${tableIdentifier} LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        const data = enforcePageSize(dataRows, limit);

        await pool.query(
            `
            INSERT INTO views_log
            (user_id, email, username, table_viewed, query_params, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                req.user.id,
                req.user.email || null,
                req.user.username,
                table,
                JSON.stringify({ page, limit }),
                req.ip
            ]
        );

        const responseData = {
            success: true,
            table,
            page,
            limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            data
        };
        await redisCache.set(cacheKey, JSON.stringify(responseData), 3600);
        return res.status(200).json(responseData);
    } catch (error) {
        return sendDatasetError(res, error, 'Failed to fetch table data');
    }
};

const getFilterOptions = async (req, res) => {
    try {
        const { table, column } = req.params;
        console.log(`[DATABASE] GET /api/data/${table}/filter-options/${column} source=Supabase/PostgreSQL reason=NOT CACHED`);
        const schema = await getDatasetTableSchema(pool, table);

        if (!schema) {
            return res.status(404).json({
                success: false,
                message: 'Dataset table not found'
            });
        }

        if (!schema.columnNames.has(column)) {
            return res.status(404).json({
                success: false,
                message: 'Column not found'
            });
        }

        const tableIdentifier = pool.escapeId(table);
        const columnIdentifier = pool.escapeId(column);
        const [options] = await pool.query(
            `
            SELECT DISTINCT ${columnIdentifier}
            FROM ${tableIdentifier}
            WHERE ${columnIdentifier} IS NOT NULL
            ORDER BY ${columnIdentifier} ASC

            `
        );
        const formattedOptions = options.map(item => item[column]);

        return res.status(200).json({
            success: true,
            table,
            column,
            totalOptions: formattedOptions.length,
            data: formattedOptions
        });
    } catch (error) {
        return sendDatasetError(res, error, 'Failed to fetch filter options');
    }
};

const searchTableData = async (req, res) => {
    try {
        const { table } = req.params;
        const {
            filters = {},
            sortBy = null,
            sortOrder = 'ASC',
            searchTerm = ''
        } = req.body || {};
        const { page, limit, offset } = parsePagination({
            ...req.query,
            ...(req.body || {})
        });
        const schema = await getDatasetTableSchema(pool, table);

        if (!schema) {
            return res.status(404).json({
                success: false,
                message: 'Dataset table not found'
            });
        }

        if (!isPlainObject(filters)) {
            return res.status(400).json({
                success: false,
                message: 'filters must be an object'
            });
        }

        if (typeof searchTerm !== 'string' || searchTerm.length > 200) {
            return res.status(400).json({
                success: false,
                message: 'searchTerm must be a string of at most 200 characters'
            });
        }

        const normalizedSearchTerm = searchTerm.trim();
        const searchLogFilters = normalizedSearchTerm
            ? { ...filters, _searchTerm: normalizedSearchTerm }
            : filters;

        if (Object.keys(filters).length > 0) {
            validateRecord(filters, 'filters');
            validateColumns(schema, filters, 'filter');
        }

        if (sortBy !== null) {
            if (typeof sortBy !== 'string' || !schema.columnNames.has(sortBy)) {
                return res.status(400).json({
                    success: false,
                    message: 'sortBy must be a column in the selected dataset'
                });
            }
        }

        const cacheKey = redisCache.datasetRowsKey(
            table,
            'search',
            {
                filters,
                searchTerm: normalizedSearchTerm,
                sortBy,
                sortOrder,
                page,
                limit
            }
        );
        const cachedResponse = await redisCache.get(cacheKey);
        if (cachedResponse) {
            console.log(`[Redis HIT] POST /api/data/${table}/search key=${cacheKey}`);
            try {
                const responseData = JSON.parse(cachedResponse);
                if (isValidCachedPage(responseData, limit)) {
                    await pool.query(
                        `INSERT INTO search_logs
                        (user_id, username, table_name, search_filters, result_count, user_ip, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [req.user.id, req.user.username, table, JSON.stringify(searchLogFilters),
                            responseData.data.length, req.ip, 'success']
                    );
                    return res.status(200).json(responseData);
                }
            } catch (error) {
                console.warn(`[Redis INVALID] POST /api/data/${table}/search key=${cacheKey}: ${error.message}`);
            }

            console.warn(`[Redis INVALID] deleting oversized or malformed page cache key=${cacheKey}`);
            await redisCache.del(cacheKey);
        }

        console.log(`[DATABASE] POST /api/data/${table}/search source=Supabase/PostgreSQL reason=Redis MISS key=${cacheKey}`);

        const tableIdentifier = pool.escapeId(table);
        const clauses = [];
        const values = [];

        for (const [column, value] of Object.entries(filters)) {
            const columnIdentifier = pool.escapeId(column);

            if (value === null) {
                clauses.push(`${columnIdentifier} IS NULL`);
            } else {
                clauses.push(`${columnIdentifier} = ?`);
                values.push(value);
            }
        }

        if (normalizedSearchTerm) {
            const searchClauses = schema.columns.map(column => (
                `CAST(${pool.escapeId(column.COLUMN_NAME)} AS TEXT) ILIKE ?`
            ));

            clauses.push(`(${searchClauses.join(' OR ')})`);
            values.push(...schema.columns.map(() => `%${normalizedSearchTerm}%`));
        }

        const whereSql = clauses.length > 0
            ? `WHERE ${clauses.join(' AND ')}`
            : '';
        const sortSql = sortBy
            ? `ORDER BY ${pool.escapeId(sortBy)} ${String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`
            : '';
        const [countResult] = await pool.query(
            `SELECT COUNT(*) AS total FROM ${tableIdentifier} ${whereSql}`,
            values
        );
        const totalRecords = Number(countResult[0].total);
        const [dataRows] = await pool.query(
            `
            SELECT *
            FROM ${tableIdentifier}
            ${whereSql}
            ${sortSql}
            LIMIT ? OFFSET ?
            `,
            [...values, limit, offset]
        );
        const data = enforcePageSize(dataRows, limit);

        await pool.query(
            `
            INSERT INTO search_logs
            (user_id, username, table_name, search_filters, result_count, user_ip, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                req.user.id,
                req.user.username,
                table,
                JSON.stringify(searchLogFilters),
                data.length,
                req.ip,
                'success'
            ]
        );

        const responseData = {
            success: true,
            table,
            filters,
            searchTerm: normalizedSearchTerm,
            page,
            limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            data
        };
        await redisCache.set(cacheKey, JSON.stringify(responseData), 3600);
        return res.status(200).json(responseData);
    } catch (error) {
        return sendDatasetError(res, error, 'Failed to search table data');
    }
};

module.exports = {
    enforcePageSize,
    isValidCachedPage,
    parsePagination,
    getAllTables,
    getTableSchema,
    getTableData,
    getFilterOptions,
    searchTableData
};
