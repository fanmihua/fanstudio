"use client"
/** 基于 @dnd-kit 的表格拖拽排序：DndSortProvider 包在表格外，SortableTableBody + 首列拖柄。 */
import React, { useState, useCallback, useMemo, createContext, useContext } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers"
import { TableBody, TableRow, TableCell } from "@/components/ui/table"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

type SortableItem = { id: string; sortOrder: number }
const ActiveDragContext = createContext<string | null>(null)

interface DndSortProviderProps<T extends SortableItem> {
  items: T[]
  onReorder: (reordered: T[]) => void
  children: React.ReactNode
}

export function DndSortProvider<T extends SortableItem>({
  items,
  onReorder,
  children,
}: DndSortProviderProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        sortOrder: idx,
      }))
      onReorder(reordered)
    },
    [items, onReorder],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ActiveDragContext.Provider value={activeId}>
        {children}
      </ActiveDragContext.Provider>
    </DndContext>
  )
}

interface SortableTableBodyProps<T extends SortableItem> {
  items: T[]
  children: (item: T, index: number) => React.ReactNode
  columnCount: number
  emptyText?: string
}

export function SortableTableBody<T extends SortableItem>({
  items,
  children,
  columnCount,
  emptyText,
}: SortableTableBodyProps<T>) {
  const { locale } = useAdminUiLocale()
  const emptyLabel = emptyText ?? (locale === "en" ? "No data" : "暂无数据")
  const ids = useMemo(() => items.map((i) => i.id), [items])
  const activeId = useContext(ActiveDragContext)

  if (items.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-8">
            {emptyLabel}
          </TableCell>
        </TableRow>
      </TableBody>
    )
  }

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <TableBody>
        {items.map((item, index) => (
          <SortableRow key={item.id} id={item.id} isActive={activeId === item.id}>
            {children(item, index)}
          </SortableRow>
        ))}
      </TableBody>
    </SortableContext>
  )
}

interface SortableRowProps {
  id: string
  isActive: boolean
  children: React.ReactNode
}

function SortableRow({ id, isActive, children }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isActive ? "bg-accent/30" : undefined}
    >
      <TableCell className="w-[40px] px-1">
        <button
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <i className="ri-draggable text-base" />
        </button>
      </TableCell>
      {children}
    </TableRow>
  )
}
