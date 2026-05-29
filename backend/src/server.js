
require('dotenv').config();

const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {

        const connection = await pool.getConnection();

        console.log('MySQL Database Connected');

        connection.release();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {

        console.error('Server Startup Error:', error);

        process.exit(1);
    }
};

startServer();