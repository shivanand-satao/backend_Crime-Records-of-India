
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');


const datasetRoutes = require('./routes/datasetRoutes');


const analyticsRoutes =require('./routes/analyticsRoutes');


const adminRoutes = require('./routes/adminRoutes');



const app = express();

app.use(cors());

app.use(helmet());

app.use(morgan('dev'));

app.use(express.json());

app.use(cookieParser());



// =========================
// ROUTES
// =========================

app.use('/api/auth', authRoutes);



app.use('/api', datasetRoutes);


app.use('/api', analyticsRoutes);



app.use('/api', adminRoutes);









// =========================
// HEALTH CHECK ROUTE
// =========================

app.get('/', (req, res) => {

    res.json({
        success: true,
        message: 'Crime Records of India API Running'
    });

});

module.exports = app;
