/** 后台设计作品列表，复用 WorksListClient。 */
import { WorksListClient } from "../WorksListClient"

export default function DesignWorksPage() {
  return <WorksListClient workType="design" />
}
