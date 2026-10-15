import jwt from 'jsonwebtoken'

// JWT payload is intentionally minimal — just enough to identify who's
// calling and enforce role checks. Never put password hashes, face
// descriptors, or other sensitive data in a token: it's base64, not
// encrypted, and readable by anyone holding it.
export const generateToken = (user) =>
  jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      tokenVersion: typeof user.tokenVersion === 'number' ? user.tokenVersion : 0,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  )

export default generateToken
