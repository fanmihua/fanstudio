/** 导航与主题文案配置，与后台「网站设置」、前台侧栏/底部栏共用默认值与 key。 */
export type NavConfig = {
  logoText?: string
  worksDesign?: string
  worksDev?: string
  blog?: string
  about?: string
  tutorials?: string
  guestbook?: string
  themeLightLabel?: string
  themeDarkLabel?: string
}

export const defaultNav: NavConfig = {
  logoText: "Fan's Studio",
  worksDesign: "设计作品",
  worksDev: "开发作品",
  blog: "知识分享",
  about: "关于我",
  tutorials: "视频教程",
  guestbook: "来坐坐",
  themeLightLabel: "亮色模式",
  themeDarkLabel: "暗色模式",
}
