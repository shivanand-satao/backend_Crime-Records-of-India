
const express = require('express');

const router = express.Router();

const authMiddleware =
require('../middleware/authMiddleware');

const {
    getAllTables,
    getTableSchema,
    getTableData,
    getFilterOptions,
    searchTableData
} = require('../controllers/datasets/datasetController');


// =====================================
// GET ALL DATASET TABLES
// =====================================

router.get(
    '/tables',
    authMiddleware,
    getAllTables
);


// =====================================
// GET TABLE SCHEMA
// =====================================

router.get(
    '/tables/:table/schema',
    authMiddleware,
    getTableSchema
);


// =====================================
// GET TABLE DATA
// =====================================

router.get(
    '/data/:table',
    authMiddleware,
    getTableData
);



// =====================================
// GET FILTER OPTIONS
// =====================================

router.get(
    '/data/:table/filter-options/:column',
    authMiddleware,
    getFilterOptions
);


// =====================================
// SEARCH + FILTER DATA
// =====================================

router.post(
    '/data/:table/search',
    authMiddleware,
    searchTableData
);




module.exports = router;
