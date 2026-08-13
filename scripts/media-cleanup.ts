import { getMediaCleanupReport, runMediaCleanupCycle } from "../src/lib/media-cleanup"

async function main() {
  const result = await runMediaCleanupCycle()
  const report = await getMediaCleanupReport()
  console.log(JSON.stringify({
    ranAt: new Date().toISOString(),
    result,
    counts: report.counts,
  }, null, 2))
}

main().catch((error) => {
  console.error("[media:cleanup]", error)
  process.exit(1)
})
