const express = require('express');

const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const {
    getAdminUsers,
    getAdminSearchLogs,
    updateTableCell,
    deleteTableRow,
    getAuditLogs,
    getAuditLogById
} = require('../controllers/admin/adminController');

// Dashboard lists include their summary-card totals in the same response.
router.get(
    '/admin/users',
    authMiddleware,
    adminMiddleware,
    getAdminUsers
);

router.get(
    '/admin/search-logs',
    authMiddleware,
    adminMiddleware,
    getAdminSearchLogs
);

// Admins use the normal authenticated dataset routes to view tables and rows.
// These mutation routes operate on only one selected row at a time.
router.patch(
    '/admin/table/:table/row',
    authMiddleware,
    adminMiddleware,
    updateTableCell
);

// PUT is retained as a method-compatible alias for clients that do not use PATCH.
router.put(
    '/admin/table/:table/row',
    authMiddleware,
    adminMiddleware,
    updateTableCell
);

router.delete(
    '/admin/table/:table/row',
    authMiddleware,
    adminMiddleware,
    deleteTableRow
);

// Audit activity is visible to authenticated administrators.
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
