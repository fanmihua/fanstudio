"use client"

import dynamic from "next/dynamic"
import type { BlockNoteEditorProps } from "./BlockNoteEditor"

const BlockNoteEditor = dynamic(
  () => import("./BlockNoteEditor").then((mod) => mod.BlockNoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground py-8">
        Loading editor…
      </div>
    ),
  },
)

export type { BlockNoteEditorProps }

export function Editor(props: BlockNoteEditorProps) {
  return <BlockNoteEditor {...props} />
}
