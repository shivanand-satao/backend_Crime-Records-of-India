const pool = require('../config/db');

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'moderator']);

class AccountRejected extends Error {
    constructor() {
        super('Account unavailable; sign in again');
    }
}

const accountId = value => {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
        return String(value);
    }
    if (typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value)
        && BigInt(value) <= 9223372036854775807n) {
        return value;
    }
    throw new AccountRejected();
};

// Called only after JWT signature/expiration verification. Never infer a table
// from a role, search both tables, or fall back for legacy ambiguous tokens.
const resolveActiveAccount = async claims => {
    if (!claims || !['user', 'admin'].includes(claims.account_kind)) {
        throw new AccountRejected();
    }
    const id = accountId(claims.id);
    const kind = claims.account_kind;
    if ((kind === 'user' && claims.role !== 'user')
        || (kind === 'admin' && !ADMIN_ROLES.has(claims.role))) {
        throw new AccountRejected();
    }
    const sql = kind === 'user'
        ? 'SELECT id, username, status FROM users WHERE id = ?'
        : 'SELECT id, username, status, role FROM admins WHERE id = ?';
    const [rows] = await pool.query(sql, [id]);
    const row = rows[0];
    if (!row || rows.length !== 1 || row.status !== 'active' || accountId(row.id) !== id) {
        throw new AccountRejected();
    }
    const role = kind === 'user' ? 'user' : row.role;
    if (role !== claims.role || (kind === 'admin' && !ADMIN_ROLES.has(role))) {
        throw new AccountRejected();
    }
    return { id, username: row.username, role, account_kind: kind, status: 'active' };
};

module.exports = { ADMIN_ROLES, AccountRejected, accountId, resolveActiveAccount };