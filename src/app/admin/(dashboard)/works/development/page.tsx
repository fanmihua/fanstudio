/** 后台开发作品列表，复用 WorksListClient。 */
import { WorksListClient } from "../WorksListClient"

export default function DevelopmentWorksPage() {
  return <WorksListClient workType="development" />
}
