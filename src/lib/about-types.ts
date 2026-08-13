/** 关于我页面的分模块数据结构，与后台设置、前台展示共用。 */
export type WorkExperienceItem = {
  company?: string
  role?: string
  period?: string
  description?: string
}

export type EducationItem = {
  school?: string
  degree?: string
  period?: string
}

export type SkillItem = {
  name?: string
  level?: string
}

/** 关于页左侧头像下方可配置的展示信息 */
export type AboutProfileCard = {
  /** 品牌/工作室名（留空则用网站名称） */
  studioName?: string
  /** 个人名称标签 */
  personalName?: string
  /** 个人职位标签 */
  personalTitle?: string
}

export type AboutModules = {
  /** 个人介绍（一段话） */
  intro?: string
  /** 工作经历列表 */
  workExperience?: WorkExperienceItem[]
  /** 学习/教育经历列表 */
  education?: EducationItem[]
  /** 技能列表 */
  skills?: SkillItem[]
  /** 关于页左侧头像下方：工作室名、个人名称、个人职位 */
  profileCard?: AboutProfileCard
  /** 兼容：content / bio 会映射到 intro */
  content?: string
  bio?: string
}

export const DEFAULT_ABOUT_MODULES: AboutModules = {
  intro: "",
  workExperience: [],
  education: [],
  skills: [],
}

/** 从 about 中解析 intro 文本，兼容 content/bio 字段。 */
export function getAboutIntro(about: AboutModules | null | undefined): string {
  if (!about || typeof about !== "object") return ""
  if (typeof about.intro === "string" && about.intro.trim()) return about.intro.trim()
  if (typeof about.content === "string" && about.content.trim()) return about.content.trim()
  if (typeof about.bio === "string" && about.bio.trim()) return about.bio.trim()
  return ""
}

/** 将 about 规范为模块结构并填充默认数组。 */
export function normalizeAboutModules(about: AboutModules | null | undefined): AboutModules {
  if (!about || typeof about !== "object") return { ...DEFAULT_ABOUT_MODULES }
  const profileCard = about.profileCard && typeof about.profileCard === "object"
    ? about.profileCard
    : undefined
  return {
    intro: typeof about.intro === "string" ? about.intro : getAboutIntro(about),
    workExperience: Array.isArray(about.workExperience) ? about.workExperience : [],
    education: Array.isArray(about.education) ? about.education : [],
    skills: Array.isArray(about.skills) ? about.skills : [],
    profileCard: profileCard
      ? {
          studioName: typeof profileCard.studioName === "string" ? profileCard.studioName : undefined,
          personalName: typeof profileCard.personalName === "string" ? profileCard.personalName : undefined,
          personalTitle: typeof profileCard.personalTitle === "string" ? profileCard.personalTitle : undefined,
        }
      : undefined,
  }
}
