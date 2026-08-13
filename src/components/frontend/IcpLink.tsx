import { ICP_RECORD, ICP_URL } from "@/lib/icp"

export function IcpLink({ className = "" }: { className?: string }) {
  if (!ICP_RECORD) return null

  return (
    <a
      href={ICP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {ICP_RECORD}
    </a>
  )
}
