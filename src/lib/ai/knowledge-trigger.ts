import { deleteKnowledgeSource, syncKnowledgeSource, syncManySources, type PublicSourceType } from "@/lib/ai/knowledge"

export async function safeSyncKnowledgeSource(sourceType: PublicSourceType, sourceId: string): Promise<void> {
  try {
    await syncKnowledgeSource(sourceType, sourceId)
  } catch (e) {
    console.error("[knowledge] sync failed:", { sourceType, sourceId, error: e })
  }
}

export async function safeSyncManySources(sourceType: PublicSourceType, sourceIds: string[]): Promise<void> {
  if (!sourceIds.length) return
  try {
    await syncManySources(sourceType, sourceIds)
  } catch (e) {
    console.error("[knowledge] syncMany failed:", { sourceType, count: sourceIds.length, error: e })
  }
}

export async function safeDeleteKnowledgeSource(sourceType: PublicSourceType, sourceId: string): Promise<void> {
  try {
    await deleteKnowledgeSource(sourceType, sourceId)
  } catch (e) {
    console.error("[knowledge] delete failed:", { sourceType, sourceId, error: e })
  }
}

