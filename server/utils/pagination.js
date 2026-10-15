// Shared query-parsing for every Admin list endpoint: page/limit bounds,
// and a whitelisted sort so a client can never inject an arbitrary
// MongoDB sort/query operator through ?sortBy=.
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

export function parsePagination(query) {
  let page = parseInt(query.page, 10)
  let limit = parseInt(query.limit, 10)

  if (!Number.isFinite(page) || page < 1) page = 1
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  return { page, limit, skip: (page - 1) * limit }
}

export function buildPaginationMeta({ page, limit }, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

/**
 * Turns `?sortBy=name&order=desc` into a Mongoose sort object, but only
 * for fields explicitly listed in `allowedFields` — anything else (or a
 * missing sortBy) falls back to `defaultSort`. This is what stops a
 * client from passing something like `sortBy=$where` straight into a
 * query.
 */
export function parseSort(query, allowedFields, defaultSort) {
  const field = allowedFields.includes(query.sortBy) ? query.sortBy : null
  if (!field) return defaultSort
  const direction = query.order === 'desc' ? -1 : 1
  return { [field]: direction }
}

export default parsePagination
