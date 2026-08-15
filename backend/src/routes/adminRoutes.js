
const express = require('express');

const router = express.Router();

const authMiddleware =
require('../middleware/authMiddleware');

const adminMiddleware =
require('../middleware/adminMiddleware');

const {
    updateTableRows,
    deleteTableRows,
    getAuditLogs,
    getAuditLogById
} = require('../controllers/admin/adminController');


// =====================================
// UPDATE ROW
// =====================================


router.put(
    '/admin/table/:table/update',
    authMiddleware,
    adminMiddleware,
    updateTableRows
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


// =====================================
// AUDIT LOGS
// =====================================

router.get(
    '/admin/audit-logs',
    authMiddleware,
    adminMiddleware,
    getAuditLogs
);

router.get(
    '/admin/audit-logs/:id',
    authMiddleware,
    adminMiddleware,
    getAuditLogById
);


module.exports = router;
