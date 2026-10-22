
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { createCorsOptions } = require('./config/cors');

const authRoutes = require('./routes/authRoutes');
const { createChatRouter } = require('./routes/chatRoutes');


const datasetRoutes = require('./routes/datasetRoutes');


const analyticsRoutes =require('./routes/analyticsRoutes');


const adminRoutes = require('./routes/adminRoutes');



const app = express();

app.use(cors(createCorsOptions()));
app.use(helmet());

// Do not include chat queries or identifiers in request logs.
app.use(morgan('dev', { skip: req => req.path === '/api/chat' || req.path.startsWith('/api/chat/') }));

app.use(express.json());

app.use(cookieParser());



// =========================
// ROUTES
// =========================

app.use('/api/auth', authRoutes);
app.use('/api/chat', createChatRouter());



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
