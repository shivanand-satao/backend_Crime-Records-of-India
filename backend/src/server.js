
require('dotenv').config();

const app = require('./app');
const pool = require('./config/db');
const redisClient = require('./config/redis');

const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Backend is running'
    });
});

const startServer = async () => {
    try {
        const connection = await pool.getConnection();

        console.log('PostgreSQL Database Connected');

        connection.release();

        // Connect to Redis
        if (redisClient && !redisClient.isOpen) {
            await redisClient.connect();
        }

        if (redisClient && redisClient.isReady) {
            console.log('Redis Connected Successfully');
        }

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Server Startup Error:', error.message);
        process.exit(1);
    }
};

startServer();
