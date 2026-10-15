import User from '../models/User.js'

export const escapeRegex = (str) => {
  if (typeof str !== 'string') return ''
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const toSearchRegex = (search) => {
  if (typeof search !== 'string' || !search.trim()) return /(?:)/
  // Limit max length of search string to prevent ReDoS / excessive queries
  const trimmed = search.trim().slice(0, 100)
  return new RegExp(escapeRegex(trimmed), 'i')
}

export const toExactRegex = (str) => {
  if (typeof str !== 'string' || !str.trim()) return /(?:)/
  const trimmed = str.trim().slice(0, 50)
  return new RegExp(`^${escapeRegex(trimmed)}$`, 'i')
}

/**
 * Student/Teacher search needs to match against the linked User's name
 * or email, but those live in a different collection. Rather than an
 * aggregation pipeline, this does one small lookup query first and
 * folds the matching User ids into the main $or — simpler to read and
 * plenty fast at this project's scale.
 */
export const findUserIdsMatching = async (regex, role) => {
  const users = await User.find({ role, $or: [{ name: regex }, { email: regex }] }).select('_id')
  return users.map((u) => u._id)
}

