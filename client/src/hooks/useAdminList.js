import { useCallback, useEffect, useState } from 'react'
import { useDebounce } from './useDebounce'
import { useToast } from '../context/ToastContext'

/**
 * Shared data-fetching state for every Admin list page: search (debounced),
 * filters, pagination, loading, and a refetch you can call after a
 * create/update/delete succeeds. One copy of this logic instead of five.
 */
export function useAdminList(apiList, { limit = 10, initialFilters = {} } = {}) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)

  const debouncedSearch = useDebounce(search, 350)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiList({ search: debouncedSearch, page, limit, ...filters })
      setItems(data.items)
      setPagination(data.pagination)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load data.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, limit, JSON.stringify(filters)])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // Reset to page 1 whenever search or filters change, so a narrowed
  // result set never lands on a page that no longer exists.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, JSON.stringify(filters)])

  const updateFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  return {
    items,
    pagination,
    loading,
    search,
    setSearch,
    filters,
    updateFilter,
    page,
    setPage,
    refetch: fetchList,
  }
}

export default useAdminList
