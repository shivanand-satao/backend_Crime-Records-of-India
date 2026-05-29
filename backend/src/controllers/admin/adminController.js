
const pool = require('../../config/db');


// =====================================
// UPDATE TABLE ROW
// =====================================


const updateTableRow = async (req, res) => {

    try {

        const { table } = req.params;

        const {
            conditions,
            updateData
        } = req.body;

        // =====================================
        // VALIDATION
        // =====================================

        if (
            !conditions ||
            Object.keys(conditions).length === 0
        ) {

            return res.status(400).json({
                success: false,
                message: 'Conditions are required'
            });
        }

        if (
            !updateData ||
            Object.keys(updateData).length === 0
        ) {

            return res.status(400).json({
                success: false,
                message: 'Update data is required'
            });
        }

        // =====================================
        // CHECK TABLE EXISTS
        // =====================================

        const [tableCheck] = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
            AND table_name = ?
            `,
            [
                process.env.DB_NAME,
                table
            ]
        );

        if (tableCheck.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        // =====================================
        // BUILD WHERE CONDITIONS
        // =====================================

        const whereClauses =
            Object.keys(conditions).map(
                key => `\`${key}\` = ?`
            );

        const whereValues =
            Object.values(conditions);

        const whereSQL =
            whereClauses.join(' AND ');

        // =====================================
        // GET OLD DATA
        // =====================================

        const [oldRows] = await pool.query(
            `
            SELECT *
            FROM \`${table}\`
            WHERE ${whereSQL}
            `,
            whereValues
        );

        if (oldRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'No matching rows found'
            });
        }

        // =====================================
        // BUILD UPDATE QUERY
        // =====================================

        const updateKeys =
            Object.keys(updateData);

        const setClauses =
            updateKeys.map(
                key => `\`${key}\` = ?`
            );

        const updateValues =
            Object.values(updateData);

        const updateQuery = `
            UPDATE \`${table}\`
            SET ${setClauses.join(', ')}
            WHERE ${whereSQL}
        `;

        // =====================================
        // EXECUTE UPDATE
        // =====================================

        const [result] = await pool.query(
            updateQuery,
            [
                ...updateValues,
                ...whereValues
            ]
        );

        // =====================================
        // LOG ADMIN MODIFICATION
        // =====================================

        await pool.query(
            `
            INSERT INTO admin_modification_logs
            (
                admin_id,
                admin_username,
                table_name,
                action_type,
                old_data,
                new_data,
                changed_columns,
                ip_address
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                req.user.id,
                req.user.username,
                table,
                'UPDATE',
                JSON.stringify(oldRows),
                JSON.stringify(updateData),
                JSON.stringify(updateKeys),
                req.ip
            ]
        );

        return res.status(200).json({
            success: true,
            message: 'Rows updated successfully',
            affectedRows: result.affectedRows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update rows'
        });
    }
};


// =====================================
// DELETE TABLE ROWS
// =====================================

const deleteTableRows = async (req, res) => {

    try {

        const { table } = req.params;

        const { conditions } = req.body;

        // =====================================
        // VALIDATION
        // =====================================

        if (
            !conditions ||
            Object.keys(conditions).length === 0
        ) {

            return res.status(400).json({
                success: false,
                message: 'Conditions are required'
            });
        }

        // =====================================
        // CHECK TABLE EXISTS
        // =====================================

        const [tableCheck] = await pool.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
            AND table_name = ?
            `,
            [
                process.env.DB_NAME,
                table
            ]
        );

        if (tableCheck.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Table not found'
            });
        }

        // =====================================
        // BUILD WHERE CONDITIONS
        // =====================================

        const whereClauses =
            Object.keys(conditions).map(
                key => `\`${key}\` = ?`
            );

        const whereValues =
            Object.values(conditions);

        const whereSQL =
            whereClauses.join(' AND ');

        // =====================================
        // GET OLD DATA
        // =====================================

        const [oldRows] = await pool.query(
            `
            SELECT *
            FROM \`${table}\`
            WHERE ${whereSQL}
            `,
            whereValues
        );

        if (oldRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'No matching rows found'
            });
        }

        // =====================================
        // DELETE QUERY
        // =====================================

        const deleteQuery = `
            DELETE FROM \`${table}\`
            WHERE ${whereSQL}
        `;

        const [result] = await pool.query(
            deleteQuery,
            whereValues
        );

        // =====================================
        // LOG DELETE ACTION
        // =====================================

        await pool.query(
            `
            INSERT INTO admin_modification_logs
            (
                admin_id,
                admin_username,
                table_name,
                action_type,
                old_data,
                changed_columns,
                ip_address
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                req.user.id,
                req.user.username,
                table,
                'DELETE',
                JSON.stringify(oldRows),
                JSON.stringify(Object.keys(conditions)),
                req.ip
            ]
        );

        return res.status(200).json({
            success: true,
            message: 'Rows deleted successfully',
            affectedRows: result.affectedRows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete rows'
        });
    }
};



module.exports = {
    updateTableRow,
    deleteTableRows
};
