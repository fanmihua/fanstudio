/** 设计作品列表页，复用 WorksListByType（type=design）。 */
import { WorksListByType } from "../WorksListByType"

export default function DesignWorksPage() {
  return (
    <WorksListByType
      type="design"
      navKey="worksDesign"
      descKey="worksDesignDesc"
    />
  )
}
