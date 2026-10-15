import mongoose from 'mongoose'

// Rejects a malformed :id param with a clean 400 before it ever reaches
// a Mongoose query (which would otherwise throw a CastError the client
// shouldn't have to decode).
export const validateObjectId =
  (paramName = 'id') =>
  (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[paramName])) {
      res.status(400)
      throw new Error(`Invalid ${paramName}`)
    }
    next()
  }

export default validateObjectId
