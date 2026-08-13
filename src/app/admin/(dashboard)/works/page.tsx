/** 作品管理入口：重定向到设计作品列表。 */
import { redirect } from "next/navigation"

export default function WorksPage() {
  redirect("/admin/works/design")
}
