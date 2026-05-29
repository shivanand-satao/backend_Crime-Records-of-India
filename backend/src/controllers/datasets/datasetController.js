const redisClient = require('../../config/redis');
const pool = require('../../config/db');



// =====================================
// GET ALL CRIME DATASET TABLES
// =====================================

const getAllTables = async (req, res) => {

    try {

        // =====================================
        // CHECK REDIS CACHE
        // =====================================

        const cachedTables =
            await redisClient.get('all_tables');

        if (cachedTables) {

            console.log(
                'Serving tables from Redis cache'
            );

            return res.status(200).json(
                JSON.parse(cachedTables)
            );
        }

        console.log(
            'Fetching tables from MySQL'
        );

        const excludedTables = [
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
        ];

        const placeholders =
            excludedTables.map(() => '?').join(',');

        const [tables] = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
            AND table_name NOT IN (${placeholders})
            `,
            [
                process.env.DB_NAME,
                ...excludedTables
            ]
        );

        const formattedTables =
            tables.map(
                table => table.TABLE_NAME || table.table_name
            );

        // =====================================
        // RESPONSE OBJECT
        // =====================================

        const responseData = {
            success: true,
            totalTables: formattedTables.length,
            data: formattedTables
        };

        // =====================================
        // STORE IN REDIS
        // =====================================

        await redisClient.set(
            'all_tables',
            JSON.stringify(responseData),
            {
                EX: 1800
            }
        );

        return res.status(200).json(
            responseData
        );

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch tables'
        });
    }
};


// =====================================
// GET TABLE SCHEMA
// =====================================

const getTableSchema = async (req, res) => {

    try {

        const { table } = req.params;
        
// =====================================
// CHECK REDIS CACHE
// =====================================

const cacheKey =
    `schema_${table}`;

const cachedSchema =
    await redisClient.get(cacheKey);

if (cachedSchema) {

    console.log(
        `Serving schema of ${table} from Redis cache`
    );

    return res.status(200).json(
        JSON.parse(cachedSchema)
    );
}

console.log(
    `Fetching schema of ${table} from MySQL`
);



        const [columns] = await pool.query(
            `
            SELECT
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE
            FROM information_schema.columns
            WHERE table_schema = ?
            AND table_name = ?
            `,
            [
                process.env.DB_NAME,
                table
            ]
        );

        if (columns.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        
// =====================================
// RESPONSE OBJECT
// =====================================

const responseData = {
    success: true,
    table,
    totalColumns: columns.length,
    columns
};

// =====================================
// STORE IN REDIS
// =====================================

await redisClient.set(
    cacheKey,
    JSON.stringify(responseData),
    {
        EX: 3600
    }
);

return res.status(200).json(
    responseData
);


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch schema'
        });
    }
};


// =====================================
// GET TABLE DATA WITH PAGINATION
// =====================================

const getTableData = async (req, res) => {

    try {

        const { table } = req.params;

        let {
            page = 1,
            limit = 20
        } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);

        const offset =
            (page - 1) * limit;

        // =====================================
        // LOG TABLE VIEW
        // =====================================

        await pool.query(
            `
            INSERT INTO views_log
            (
                user_id,
                email,
                username,
                table_viewed,
                ip_address
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                req.user.id,
                req.user.email || null,
                req.user.username,
                table,
                req.ip
            ]
        );

        // =====================================
        // CHECK TABLE EXISTS
        // =====================================

        const [tableCheck] = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
            AND table_name = ?
            `,
            [
                process.env.DB_NAME,
                table
            ]
        );

        if (tableCheck.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        // =====================================
        // GET TOTAL RECORDS
        // =====================================

        const [countResult] = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM \`${table}\`
            `
        );

        const totalRecords =
            countResult[0].total;

        // =====================================
        // GET DATA
        // =====================================

        const [data] = await pool.query(
            `
            SELECT *
            FROM \`${table}\`
            LIMIT ?
            OFFSET ?
            `,
            [
                limit,
                offset
            ]
        );

        return res.status(200).json({
            success: true,
            table,
            page,
            limit,
            totalRecords,
            totalPages:
                Math.ceil(totalRecords / limit),
            data
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch table data'
        });
    }
};


// =====================================
// GET FILTER OPTIONS
// =====================================

const getFilterOptions = async (req, res) => {

    try {

        const {
            table,
            column
        } = req.params;

        // =====================================
        // CHECK TABLE EXISTS
        // =====================================

        const [tableCheck] = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
            AND table_name = ?
            `,
            [
                process.env.DB_NAME,
                table
            ]
        );

        if (tableCheck.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        // =====================================
        // CHECK COLUMN EXISTS
        // =====================================

        const [columnCheck] = await pool.query(
            `
            SELECT COLUMN_NAME
            FROM information_schema.columns
            WHERE table_schema = ?
            AND table_name = ?
            AND column_name = ?
            `,
            [
                process.env.DB_NAME,
                table,
                column
            ]
        );

        if (columnCheck.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Column not found'
            });
        }

        // =====================================
        // GET DISTINCT VALUES
        // =====================================

        const [options] = await pool.query(
            `
            SELECT DISTINCT \`${column}\`
            FROM \`${table}\`
            WHERE \`${column}\` IS NOT NULL
            ORDER BY \`${column}\` ASC
            `
        );

        const formattedOptions =
            options.map(
                item => item[column]
            );

        return res.status(200).json({
            success: true,
            table,
            column,
            totalOptions:
                formattedOptions.length,
            data: formattedOptions
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch filter options'
        });
    }
};


// =====================================
// DYNAMIC SEARCH + FILTER API
// =====================================

const searchTableData = async (req, res) => {

    try {

        const { table } = req.params;

        let {
            filters = {},
            page = 1,
            limit = 20,
            sortBy = null,
            sortOrder = 'ASC'
        } = req.body;

        page = parseInt(page);
        limit = parseInt(limit);

        const offset =
            (page - 1) * limit;

        // =====================================
        // CHECK TABLE EXISTS
        // =====================================

        const [tableCheck] = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
            AND table_name = ?
            `,
            [
                process.env.DB_NAME,
                table
            ]
        );

        if (tableCheck.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        // =====================================
        // BUILD WHERE CONDITIONS
        // =====================================

        let whereClauses = [];
        let queryValues = [];

        for (const key in filters) {

            whereClauses.push(
                `\`${key}\` = ?`
            );

            queryValues.push(filters[key]);
        }

        const whereSQL =
            whereClauses.length > 0
                ? `WHERE ${whereClauses.join(' AND ')}`
                : '';

        // =====================================
        // SORTING
        // =====================================

        let sortSQL = '';

        if (sortBy) {

            sortSQL =
                `ORDER BY \`${sortBy}\` ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}`;
        }

        // =====================================
        // TOTAL COUNT
        // =====================================

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM \`${table}\`
            ${whereSQL}
        `;

        const [countResult] =
            await pool.query(
                countQuery,
                queryValues
            );

        const totalRecords =
            countResult[0].total;

        // =====================================
        // MAIN DATA QUERY
        // =====================================

        const dataQuery = `
            SELECT *
            FROM \`${table}\`
            ${whereSQL}
            ${sortSQL}
            LIMIT ?
            OFFSET ?
        `;

        const [data] = await pool.query(
            dataQuery,
            [
                ...queryValues,
                limit,
                offset
            ]
        );

        // =====================================
        // LOG SEARCH
        // =====================================

        await pool.query(
            `
            INSERT INTO search_logs
            (
                user_id,
                username,
                table_name,
                search_filters,
                result_count,
                user_ip,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                req.user.id,
                req.user.username,
                table,
                JSON.stringify(filters),
                data.length,
                req.ip,
                'success'
            ]
        );

        return res.status(200).json({
            success: true,
            table,
            filters,
            page,
            limit,
            totalRecords,
            totalPages:
                Math.ceil(totalRecords / limit),
            data
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to search table data'
        });
    }
};


module.exports = {
    getAllTables,
    getTableSchema,
    getTableData,
    getFilterOptions,
    searchTableData
};

