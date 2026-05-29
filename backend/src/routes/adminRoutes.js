
const express = require('express');

const router = express.Router();

const authMiddleware =
require('../middleware/authMiddleware');

const adminMiddleware =
require('../middleware/adminMiddleware');

const {
    updateTableRow,
    deleteTableRows
} = require('../controllers/admin/adminController');


// =====================================
// UPDATE ROW
// =====================================


router.put(
    '/admin/table/:table/update',
    authMiddleware,
    adminMiddleware,
    updateTableRow
);



// =====================================
// DELETE ROWS
// =====================================

router.delete(
    '/admin/table/:table/delete',
    authMiddleware,
    adminMiddleware,
    deleteTableRows
);


module.exports = router;
