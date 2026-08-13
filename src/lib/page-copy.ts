/** 各页页头介绍与首页 Hero 文案，与后台「网站设置」、前台共用默认值。 */
/** 「真实版」生活动态：可选图片 + 中英配文（或纯文字）。一份共享列表，配文按语言取。 */
export type LifeMoment = {
  id: string
  image?: string
  textZh?: string
  textEn?: string
  pinned?: boolean
  musicId?: string // 网易云歌曲数字 ID，存在时在卡片里渲染「去网易云听」音乐卡
  musicName?: string // 歌名（音乐卡展示）
  musicArtist?: string // 歌手
  musicCover?: string // 封面图 URL
}

export type PageCopy = {
  worksDesignDesc?: string
  worksDevDesc?: string
  blogDesc?: string
  tutorialsDesc?: string
  showWorksDesign?: boolean
  showWorksDev?: boolean
  showBlog?: boolean
  showTutorials?: boolean
  showGuestbook?: boolean
  showLanguageSwitcher?: boolean
  navOrder?: string[]
  aboutDesc?: string
  showResume?: boolean // 关于页：显示「查看简历」按钮
  showPortfolio?: boolean // 关于页：显示「查看作品集」按钮
  resumeUrl?: string // 简历链接
  portfolioUrl?: string // 作品集链接
  guestbookName?: string // 留言板模块名（中文）
  guestbookNameEn?: string // 留言板模块名（英文）
  guestbookGreeting?: string // 留言板「我的话」(中文)
  guestbookGreetingEn?: string // 留言板「我的话」(英文)
  lifeMoments?: LifeMoment[] // 关于页「真实版」生活动态
  heroGreeting?: string
  heroPrefix?: string
  heroDesc?: string
  siteDescription?: string
  siteFavicon?: string
  aboutWorkTitle?: string
  aboutEducationTitle?: string
  aboutSkillsTitle?: string
  coverRatioWorksDesign?: string
  coverRatioWorksDev?: string
  coverRatioBlog?: string
  coverRatioTutorials?: string
}

export const defaultPageCopy: PageCopy = {
  worksDesignDesc: "精选设计作品，部分支持赞助下载源文件",
  worksDevDesc: "开源项目与开发作品展示",
  blogDesc: "分享设计思考、工具技巧与行业见解",
  tutorialsDesc: "视频类教材合集，包含 B 站、YouTube 等",
  showWorksDesign: true,
  showWorksDev: true,
  showBlog: true,
  showTutorials: true,
  showGuestbook: true,
  showLanguageSwitcher: true,
  navOrder: ["worksDesign", "worksDev", "blog", "tutorials"],
  aboutDesc: "",
  showResume: false,
  showPortfolio: false,
  resumeUrl: "",
  portfolioUrl: "",
  guestbookName: "来坐坐",
  guestbookNameEn: "Pull Up a Chair",
  guestbookGreeting: "嗨，欢迎来坐坐 ☕ 这是我留给你的小角落，随便聊点什么都行，留句话再走呀～",
  guestbookGreetingEn: "Hey, glad you pulled up a chair ☕ This little corner is yours — say anything, and leave a word before you go~",
  lifeMoments: [],
  heroGreeting: "Hey,",
  heroPrefix: "You're in ",
  heroDesc: "Welcome to my world.",
  siteDescription: "UI/UX 设计师，专注于用户体验与视觉设计。",
  aboutWorkTitle: "工作经历",
  aboutEducationTitle: "学习经历",
  aboutSkillsTitle: "技能",
  coverRatioWorksDesign: "3:4",
  coverRatioWorksDev: "3:4",
  coverRatioBlog: "3:4",
  coverRatioTutorials: "3:4",
}

/** 默认网站描述（SEO meta description） */
export const defaultSiteDescription = defaultPageCopy.siteDescription!

/** 网站名称默认值（API、后台、前台 fallback 共用） */
export const defaultSiteName = "Fan's Studio"

/** 个人信息展示默认值（Hero、关于页、作者 fallback 共用） */
export const defaultPersonalName = "Your Name"

export type FrontendSectionVisibility = {
  worksDesign: boolean
  worksDev: boolean
  blog: boolean
  tutorials: boolean
  guestbook: boolean
  languageSwitcher: boolean
}

export function resolveFrontendSectionVisibility(pageCopy?: PageCopy | null): FrontendSectionVisibility {
  return {
    worksDesign: typeof pageCopy?.showWorksDesign === "boolean" ? pageCopy.showWorksDesign : true,
    worksDev: typeof pageCopy?.showWorksDev === "boolean" ? pageCopy.showWorksDev : true,
    blog: typeof pageCopy?.showBlog === "boolean" ? pageCopy.showBlog : true,
    tutorials: typeof pageCopy?.showTutorials === "boolean" ? pageCopy.showTutorials : true,
    guestbook: typeof pageCopy?.showGuestbook === "boolean" ? pageCopy.showGuestbook : true,
    languageSwitcher: typeof pageCopy?.showLanguageSwitcher === "boolean" ? pageCopy.showLanguageSwitcher : true,
  }
}

export const REORDERABLE_NAV_KEYS = ["worksDesign", "worksDev", "blog", "tutorials"] as const
export type ReorderableNavKey = (typeof REORDERABLE_NAV_KEYS)[number]

/** 校验并补全导航排序：去重、剔除未知项、缺失项按默认顺序补到末尾，始终返回全部 4 项。 */
export function resolveNavOrder(pageCopy?: PageCopy | null): ReorderableNavKey[] {
  const raw = Array.isArray(pageCopy?.navOrder) ? pageCopy?.navOrder ?? [] : []
  const known = REORDERABLE_NAV_KEYS as readonly string[]
  const seen = new Set<string>()
  const ordered: ReorderableNavKey[] = []
  for (const key of raw) {
    if (known.includes(key) && !seen.has(key)) {
      ordered.push(key as ReorderableNavKey)
      seen.add(key)
    }
  }
  for (const key of REORDERABLE_NAV_KEYS) {
    if (!seen.has(key)) ordered.push(key)
  }
  return ordered
}

/** 站点名归一化：空或无效时返回默认站点名 */
export function normalizeSiteName(s: string | null | undefined): string {
  const t = s?.trim()
  if (!t || t === "Fan's Portfolio") return defaultSiteName
  return t
}
