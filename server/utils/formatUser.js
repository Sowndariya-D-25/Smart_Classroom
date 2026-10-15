// Shapes a User document into the safe subset returned to the client.
// Centralized here so no controller can accidentally leak the password
// hash by spreading the raw document into a response.
export const sanitizeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || null,
  isActive: user.isActive,
  lastLogin: user.lastLogin,
})

export default sanitizeUser
