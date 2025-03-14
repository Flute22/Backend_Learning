const asyncHandler = (requestHandler) => {
    (req, res, next) => {
        Promise
        .resolve(requestHandler(req, res, next))
        .reject((err) => {
            res.send(err.code || 500).json({
                success: false, 
                message: err.message
            })
        })
    }
}

export { asyncHandler }