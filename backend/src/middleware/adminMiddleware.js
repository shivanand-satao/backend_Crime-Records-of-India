
const adminMiddleware = (req, res, next) => {

    try {

        if (
            !req.user ||
            (
                req.user.role !== 'admin' &&
                req.user.role !== 'superadmin' &&
                req.user.role !== 'moderator'
            )
        ) {

            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        next();

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: 'Authorization error'
        });
    }
};

module.exports = adminMiddleware;

