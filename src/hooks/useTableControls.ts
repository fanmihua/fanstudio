"use client"

import { useState, useMemo, useCallback } from "react"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SortDirection = "asc" | "desc" | null

export interface FilterOption {
  label: string
  value: string
}

export interface FilterConfig {
  key: string
  label: string
  options: FilterOption[]
}

export interface UseTableControlsOptions<T> {
  /** Raw data array */
  data: T[]
  /** Fields to search (dot-path not supported, top-level only) */
  searchFields?: (keyof T)[]
  /** Default page size */
  defaultPageSize?: number
  /** Default sort column */
  defaultSortColumn?: keyof T | null
  /** Default sort direction */
  defaultSortDirection?: SortDirection
}

export interface UseTableControlsReturn<T> {
  /* search */
  searchTerm: string
  setSearchTerm: (v: string) => void

  /* filters: key -> selected value ("all" means no filter) */
  filters: Record<string, string>
  setFilter: (key: string, value: string) => void
  resetFilters: () => void

  /* sort */
  sortColumn: keyof T | null
  sortDirection: SortDirection
  toggleSort: (column: keyof T) => void

  /* pagination */
  page: number
  pageSize: number
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  totalItems: number
  totalPages: number

  /* selection */
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  toggleSelectAll: () => void
  clearSelection: () => void
  isAllSelected: boolean

  /* computed */
  filteredData: T[]
  pagedData: T[]

  /** Whether any search/filter/sort is active (useful for dnd mode toggle) */
  isFiltering: boolean
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useTableControls<T extends { id: string }>(
  options: UseTableControlsOptions<T>
): UseTableControlsReturn<T> {
  const {
    data,
    searchFields = [],
    defaultPageSize = 20,
    defaultSortColumn = null,
    defaultSortDirection = null,
  } = options

  /* ---- state ---- */
  const [searchTerm, setSearchTerm] = useState("")
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortColumn, setSortColumn] = useState<keyof T | null>(defaultSortColumn)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(defaultPageSize)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  /* ---- filter helpers ---- */
  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({})
    setSearchTerm("")
    setSortColumn(defaultSortColumn)
    setSortDirection(defaultSortDirection)
    setPage(1)
  }, [defaultSortColumn, defaultSortDirection])

  /* ---- search + filter ---- */
  const searched = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term || searchFields.length === 0) return data
    return data.filter((item) =>
      searchFields.some((field) => {
        const val = item[field]
        if (typeof val === "string") return val.toLowerCase().includes(term)
        if (typeof val === "number") return String(val).includes(term)
        return false
      })
    )
  }, [data, searchTerm, searchFields])

  const filtered = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(
      ([, v]) => v && v !== "all"
    )
    if (activeFilters.length === 0) return searched
    return searched.filter((item) =>
      activeFilters.every(([key, value]) => {
        const field = item[key as keyof T]
        if (field === null || field === undefined) return false
        /* support nested category?.name via "category.name" key */
        if (key.includes(".")) {
          const parts = key.split(".")
          let cur: unknown = item
          for (const p of parts) {
            if (cur && typeof cur === "object") {
              cur = (cur as Record<string, unknown>)[p]
            } else {
              return false
            }
          }
          return String(cur) === value
        }
        if (typeof field === "boolean") return String(field) === value
        return String(field) === value
      })
    )
  }, [searched, filters])

  /* ---- sort ---- */
  const sorted = useMemo(() => {
    if (!sortColumn || !sortDirection) return filtered
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      let cmp = 0
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal, "zh-CN")
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal
      } else {
        cmp = String(aVal).localeCompare(String(bVal), "zh-CN")
      }
      return sortDirection === "asc" ? cmp : -cmp
    })
  }, [filtered, sortColumn, sortDirection])

  const toggleSort = useCallback(
    (column: keyof T) => {
      if (sortColumn === column) {
        if (sortDirection === "asc") setSortDirection("desc")
        else if (sortDirection === "desc") {
          setSortColumn(null)
          setSortDirection(null)
        }
      } else {
        setSortColumn(column)
        setSortDirection("asc")
      }
      setPage(1)
    },
    [sortColumn, sortDirection]
  )

  /* ---- pagination ---- */
  const totalItems = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)

  const pagedData = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, safePage, pageSize])

  const setPageSize = useCallback((s: number) => {
    setPageSizeState(s)
    setPage(1)
  }, [])

  /* ---- selection ---- */
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const isAllSelected = pagedData.length > 0 && pagedData.every((d) => selectedIds.has(d.id))

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        pagedData.forEach((d) => next.delete(d.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        pagedData.forEach((d) => next.add(d.id))
        return next
      })
    }
  }, [isAllSelected, pagedData])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  /* ---- isFiltering ---- */
  const isFiltering =
    searchTerm.trim() !== "" ||
    Object.values(filters).some((v) => v && v !== "all") ||
    sortColumn !== null

  return {
    searchTerm,
    setSearchTerm: (v: string) => { setSearchTerm(v); setPage(1) },
    filters,
    setFilter,
    resetFilters,
    sortColumn,
    sortDirection,
    toggleSort,
    page: safePage,
    pageSize,
    setPage,
    setPageSize,
    totalItems,
    totalPages,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAllSelected,
    filteredData: sorted,
    pagedData,
    isFiltering,
  }
}
