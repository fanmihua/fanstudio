/** 开发作品列表页，复用 WorksListByType（type=development）。 */
import { WorksListByType } from "../WorksListByType"

export default function DevelopmentWorksPage() {
  return (
    <WorksListByType
      type="development"
      navKey="worksDev"
      descKey="worksDevDesc"
    />
  )
}
