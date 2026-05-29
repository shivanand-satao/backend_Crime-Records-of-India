const redisClient = require('../../config/redis');
const pool = require('../../config/db');


// =====================================
// ANALYTICS OVERVIEW
// =====================================

const getAnalyticsOverview = async (req, res) => {

        
// =====================================
// CHECK REDIS CACHE
// =====================================

const cachedAnalytics =
    await redisClient.get(
        'analytics_overview'
    );

if (cachedAnalytics) {

    console.log(
        'Serving analytics from Redis cache'
    );

    return res.status(200).json(
        JSON.parse(cachedAnalytics)
    );
}

console.log(
    'Fetching analytics from MySQL'
);


    try {

        // TOTAL USERS

        const [usersResult] = await pool.query(
            `
            SELECT COUNT(*) AS totalUsers
            FROM users
            `
        );

        // TOTAL ADMINS

        const [adminsResult] = await pool.query(
            `
            SELECT COUNT(*) AS totalAdmins
            FROM admins
            `
        );

        // TOTAL TABLES

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

        const [tablesResult] = await pool.query(
            `
            SELECT COUNT(*) AS totalTables
            FROM information_schema.tables
            WHERE table_schema = ?
            AND table_name NOT IN (${placeholders})
            `,
            [
                process.env.DB_NAME,
                ...excludedTables
            ]
        );

        // TOTAL VIEWS

        const [viewsResult] = await pool.query(
            `
            SELECT COUNT(*) AS totalViews
            FROM views_log
            `
        );

        // TOTAL SEARCHES

        const [searchResult] = await pool.query(
            `
            SELECT COUNT(*) AS totalSearches
            FROM search_logs
            `
        );

        // MOST VIEWED TABLE

        const [mostViewedResult] = await pool.query(
            `
            
            SELECT
            table_viewed,
            COUNT(*) AS total
            FROM views_log
            GROUP BY table_viewed
            ORDER BY total DESC
            LIMIT 1


            `
        );

        // RECENT LOGINS

        const [recentUsers] = await pool.query(
            `
            SELECT COUNT(*) AS recentLogins
            FROM users
            WHERE last_login >= NOW() - INTERVAL 7 DAY
            `
        );

                
// =====================================
// RESPONSE OBJECT
// =====================================


const responseData = {
    success: true,

    totalUsers:
        usersResult[0].totalUsers,

    totalAdmins:
        adminsResult[0].totalAdmins,

    totalTables:
        tablesResult[0].totalTables,

    totalViews:
        viewsResult[0].totalViews,

    totalSearches:
        searchResult[0].totalSearches,

    mostViewedTable:
        mostViewedResult[0] || null,

    recentLogins:
        recentUsers[0].recentLogins
};


// =====================================
// STORE IN REDIS
// =====================================

await redisClient.set(
    'analytics_overview',
    JSON.stringify(responseData),
    {
        EX: 300
    }
);

return res.status(200).json(
    responseData
);



    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics'
        });
    }
};

module.exports = {
    getAnalyticsOverview
};

