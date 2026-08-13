import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

function paragraph(id: string, text: string) {
  return {
    id,
    type: "paragraph",
    props: {
      textColor: "default",
      textAlignment: "left",
      backgroundColor: "default",
    },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  }
}

function heading(id: string, text: string) {
  return {
    id,
    type: "heading",
    props: {
      level: 2,
      textColor: "default",
      textAlignment: "left",
      backgroundColor: "default",
      isToggleable: false,
    },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  }
}

function bullet(id: string, text: string) {
  return {
    id,
    type: "bulletListItem",
    props: {
      textColor: "default",
      textAlignment: "left",
      backgroundColor: "default",
    },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  }
}

async function main() {
  console.log("开始初始化数据库...")

  const adminEmail = "owner@local.test"
  const adminPassword = "ChangeMeAdmin123!"
  const viewerEmail = "viewer@local.test"
  const viewerPassword = "ChangeMeViewer123!"

  // 创建管理员用户
  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashedPassword, name: "Fan", role: "ADMIN", bio: "一名热爱设计的创作者，专注于用户体验与视觉设计。" },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: "Fan",
      role: "ADMIN",
      bio: "一名热爱设计的创作者，专注于用户体验与视觉设计。",
    },
  })

  console.log("管理员用户已创建:", admin.email)

  // 创建体验账户（只读，用于公开演示）
  const demoPassword = await bcrypt.hash(viewerPassword, 10)
  const demo = await prisma.user.upsert({
    where: { email: viewerEmail },
    update: { password: demoPassword, name: "体验用户", role: "VIEWER" },
    create: {
      email: viewerEmail,
      password: demoPassword,
      name: "体验用户",
      role: "VIEWER",
      bio: "这是一个只读体验账户，可以浏览后台所有功能，但无法修改内容。",
    },
  })

  console.log("体验账户已创建:", demo.email)

  // 创建默认分类
  const postCategories = [
    { name: "设计方法", slug: "design-method" },
    { name: "工具技巧", slug: "tools" },
    { name: "设计思考", slug: "thinking" },
    { name: "视觉设计", slug: "visual" },
  ]

  const workCategories = [
    { name: "UI 设计", slug: "ui-design" },
    { name: "App 设计", slug: "app-design" },
    { name: "网页设计", slug: "web-design" },
    { name: "图标设计", slug: "icon-design" },
    { name: "插画", slug: "illustration" },
  ]

  for (const category of postCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        name: category.name,
        slug: category.slug,
        type: "POST",
      },
    })
  }

  for (const category of workCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        name: category.name,
        slug: category.slug,
        type: "WORK",
      },
    })
  }

  console.log("默认分类已创建")

  // 创建默认标签
  const tags = ["Figma", "设计系统", "用户体验", "原型设计", "配色", "字体"]

  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName },
    })
  }

  console.log("默认标签已创建")

  // 创建网站设置
  const publicSettings = {
    siteName: "Fan's Studio",
    defaultLocale: "ZH" as const,
    socialLinks: {
      figma: "https://figma.com/@fanyunyun",
      github: "https://github.com/fanmihua",
    },
    pageCopy: {
      showWorksDesign: true,
      showWorksDev: true,
      showBlog: false,
      showTutorials: false,
      showGuestbook: true,
      showLanguageSwitcher: true,
    },
    footerI18n: {
      zh: { copyrightText: "范米花儿" },
      en: { copyrightText: "Fan Mihua" },
    },
    navI18n: {
      zh: {
        logoText: "Fan's Studio",
        worksDesign: "设计作品",
        worksDev: "开发作品",
        blog: "知识分享",
        tutorials: "视频教程",
        about: "关于我",
      },
      en: {
        logoText: "Fan's Studio",
        worksDesign: "Design",
        worksDev: "Development",
        blog: "Blog",
        tutorials: "Tutorials",
        about: "About",
      },
    },
  }
  await prisma.settings.upsert({
    where: { id: "settings" },
    update: publicSettings,
    create: {
      id: "settings",
      ...publicSettings,
    },
  })

  console.log("网站设置已创建")

  // 两个案例均来自作者已经公开的网站内容；只保留公开展示所需字段。
  const [designCategory, developmentCategory] = await Promise.all([
    prisma.category.upsert({
      where: { slug: "ai-product-design" },
      update: {
        name: "AI 产品设计",
        nameI18n: { zh: "AI 产品设计", en: "AI Product Design" },
        slugI18n: { zh: "ai-product-design", en: "ai-product-design" },
        type: "DESIGN",
      },
      create: {
        name: "AI 产品设计",
        slug: "ai-product-design",
        nameI18n: { zh: "AI 产品设计", en: "AI Product Design" },
        slugI18n: { zh: "ai-product-design", en: "ai-product-design" },
        type: "DESIGN",
      },
    }),
    prisma.category.upsert({
      where: { slug: "web-applications" },
      update: {
        name: "Web 应用",
        nameI18n: { zh: "Web 应用", en: "Web Applications" },
        slugI18n: { zh: "web-applications", en: "web-applications" },
        type: "DEVELOPMENT",
      },
      create: {
        name: "Web 应用",
        slug: "web-applications",
        nameI18n: { zh: "Web 应用", en: "Web Applications" },
        slugI18n: { zh: "web-applications", en: "web-applications" },
        type: "DEVELOPMENT",
      },
    }),
  ])

  const [aiApplicationTag, componentLibraryTag, personalWebsiteTag, openSourceTag] = await Promise.all([
    prisma.tag.upsert({
      where: { name: "AI 应用" },
      update: { nameI18n: { zh: "AI 应用", en: "AI Applications" } },
      create: { name: "AI 应用", nameI18n: { zh: "AI 应用", en: "AI Applications" } },
    }),
    prisma.tag.upsert({
      where: { name: "组件库" },
      update: { nameI18n: { zh: "组件库", en: "Component Library" } },
      create: { name: "组件库", nameI18n: { zh: "组件库", en: "Component Library" } },
    }),
    prisma.tag.upsert({
      where: { name: "个人网站" },
      update: { nameI18n: { zh: "个人网站", en: "Personal Website" } },
      create: { name: "个人网站", nameI18n: { zh: "个人网站", en: "Personal Website" } },
    }),
    prisma.tag.upsert({
      where: { name: "开源" },
      update: { nameI18n: { zh: "开源", en: "Open Source" } },
      create: { name: "开源", nameI18n: { zh: "开源", en: "Open Source" } },
    }),
  ])

  const websiteContentZh = [
    heading("website-zh-1", "为什么做这个网站"),
    paragraph("website-zh-2", "我希望拥有一个可以持续更新作品、文章和教程的个人网站，同时保留完整的后台管理能力。"),
    heading("website-zh-3", "核心能力"),
    bullet("website-zh-4", "前后台一体：作品、文章、教程、分类、标签、媒体和网站设置都能在后台维护。"),
    bullet("website-zh-5", "支持中英双语、主题配置、深色模式、响应式布局和可视化富文本编辑。"),
    bullet("website-zh-6", "包含站内 AI 助手、留言板，以及设计作品的赞助和数字交付流程。"),
    heading("website-zh-7", "技术栈"),
    paragraph("website-zh-8", "Next.js、React、TypeScript、Tailwind CSS、Prisma、MySQL 与 NextAuth。"),
  ]
  const websiteContentEn = [
    heading("website-en-1", "Why I built it"),
    paragraph("website-en-2", "I wanted a personal website where works, articles, and tutorials can evolve over time, backed by a complete admin workspace."),
    heading("website-en-3", "Core capabilities"),
    bullet("website-en-4", "Integrated frontend and admin management for works, posts, tutorials, taxonomy, media, and site settings."),
    bullet("website-en-5", "Bilingual content, theme controls, dark mode, responsive layouts, and visual rich-text editing."),
    bullet("website-en-6", "An on-site AI assistant, guestbook, and a support-and-delivery flow for design resources."),
    heading("website-en-7", "Stack"),
    paragraph("website-en-8", "Next.js, React, TypeScript, Tailwind CSS, Prisma, MySQL, and NextAuth."),
  ]

  await prisma.work.upsert({
    where: { slug: "personal-website-builder" },
    update: {
      title: "个人建站工具",
      titleI18n: { zh: "个人建站工具", en: "Personal Website Builder" },
      slugI18n: { zh: "personal-website-builder", en: "personal-website-builder" },
      workType: "DEVELOPMENT",
      description: "<p>前后台一体的个人建站工具</p>",
      descriptionI18n: {
        zh: "<p>前后台一体的个人建站工具</p>",
        en: "<p>An integrated frontend and admin tool for building a personal website.</p>",
      },
      content: websiteContentZh,
      contentI18n: { zh: websiteContentZh, en: websiteContentEn },
      seoI18n: {
        zh: { title: "个人建站工具", description: "前后台一体的个人建站工具" },
        en: { title: "Personal Website Builder", description: "An integrated personal website and admin workspace." },
      },
      coverImage: "/demo/works/personal-website-builder/cover.webp",
      coverRatio: "3:4",
      images: [],
      currentVersion: null,
      price: null,
      isFree: false,
      figmaUrl: null,
      deliveryUrl: null,
      fileUrl: null,
      fileName: null,
      demoUrl: "https://fanstudio.cn/zh",
      demoQrCode: null,
      status: "PUBLISHED",
      categoryId: developmentCategory.id,
      sortOrder: 0,
      tags: { set: [{ id: personalWebsiteTag.id }, { id: openSourceTag.id }] },
    },
    create: {
      title: "个人建站工具",
      slug: "personal-website-builder",
      titleI18n: { zh: "个人建站工具", en: "Personal Website Builder" },
      slugI18n: { zh: "personal-website-builder", en: "personal-website-builder" },
      workType: "DEVELOPMENT",
      description: "<p>前后台一体的个人建站工具</p>",
      descriptionI18n: {
        zh: "<p>前后台一体的个人建站工具</p>",
        en: "<p>An integrated frontend and admin tool for building a personal website.</p>",
      },
      content: websiteContentZh,
      contentI18n: { zh: websiteContentZh, en: websiteContentEn },
      seoI18n: {
        zh: { title: "个人建站工具", description: "前后台一体的个人建站工具" },
        en: { title: "Personal Website Builder", description: "An integrated personal website and admin workspace." },
      },
      coverImage: "/demo/works/personal-website-builder/cover.webp",
      coverRatio: "3:4",
      images: [],
      demoUrl: "https://fanstudio.cn/zh",
      status: "PUBLISHED",
      categoryId: developmentCategory.id,
      authorId: admin.id,
      sortOrder: 0,
      tags: { connect: [{ id: personalWebsiteTag.id }, { id: openSourceTag.id }] },
    },
  })

  const componentContentZh = [
    heading("component-zh-1", "案例概览"),
    paragraph("component-zh-2", "这套 AI 界面组件库围绕真实对话产品的结构和状态搭建，包含完整变量体系与交互示例。"),
    heading("component-zh-3", "内容构成"),
    bullet("component-zh-4", "基础组件：图标、导航、页头、输入框、文件上传和多种内容输出。"),
    bullet("component-zh-5", "复合组件：导航、输入、用户消息与 AI 消息的多尺寸、多状态组合。"),
    bullet("component-zh-6", "页面示例：常见 AI 对话页框架与交互动画。"),
  ]
  const componentContentEn = [
    heading("component-en-1", "Overview"),
    paragraph("component-en-2", "This AI interface component library is built around real conversational product structures and states, with a complete variable system and interaction examples."),
    heading("component-en-3", "What is included"),
    bullet("component-en-4", "Foundations for icons, navigation, headers, inputs, file uploads, and multiple output formats."),
    bullet("component-en-5", "Composite navigation, input, user-message, and AI-message components across sizes and states."),
    bullet("component-en-6", "Page examples for common AI conversation layouts and motion patterns."),
  ]

  const publicFigmaUrl = "https://www.figma.com/community/file/1477583157011425173/ai-ai-kits"
  await prisma.work.upsert({
    where: { slug: "ai-component-library" },
    update: {
      title: "AI 组件库",
      titleI18n: { zh: "AI 组件库", en: "AI Component Library" },
      slugI18n: { zh: "ai-component-library", en: "ai-component-library" },
      workType: "DESIGN",
      description: "<p>完整变量体系，包含 20+ 类基础、复合组件及交互动画示例</p>",
      descriptionI18n: {
        zh: "<p>完整变量体系，包含 20+ 类基础、复合组件及交互动画示例</p>",
        en: "<p>A complete variable system with 20+ foundational and composite component categories and interaction examples.</p>",
      },
      content: componentContentZh,
      contentI18n: { zh: componentContentZh, en: componentContentEn },
      seoI18n: {
        zh: { title: "AI 组件库", description: "包含基础、复合组件与交互动画示例的 AI 界面组件库" },
        en: { title: "AI Component Library", description: "An AI interface library with foundational, composite, and interaction examples." },
      },
      coverImage: "/demo/works/ai-component-library/cover.webp",
      coverRatio: "3:4",
      images: [],
      currentVersion: "1.0",
      price: 0,
      isFree: true,
      figmaUrl: publicFigmaUrl,
      deliveryUrl: null,
      fileUrl: null,
      fileName: null,
      demoUrl: null,
      demoQrCode: null,
      status: "PUBLISHED",
      categoryId: designCategory.id,
      sortOrder: 0,
      tags: { set: [{ id: aiApplicationTag.id }, { id: componentLibraryTag.id }] },
    },
    create: {
      title: "AI 组件库",
      slug: "ai-component-library",
      titleI18n: { zh: "AI 组件库", en: "AI Component Library" },
      slugI18n: { zh: "ai-component-library", en: "ai-component-library" },
      workType: "DESIGN",
      description: "<p>完整变量体系，包含 20+ 类基础、复合组件及交互动画示例</p>",
      descriptionI18n: {
        zh: "<p>完整变量体系，包含 20+ 类基础、复合组件及交互动画示例</p>",
        en: "<p>A complete variable system with 20+ foundational and composite component categories and interaction examples.</p>",
      },
      content: componentContentZh,
      contentI18n: { zh: componentContentZh, en: componentContentEn },
      seoI18n: {
        zh: { title: "AI 组件库", description: "包含基础、复合组件与交互动画示例的 AI 界面组件库" },
        en: { title: "AI Component Library", description: "An AI interface library with foundational, composite, and interaction examples." },
      },
      coverImage: "/demo/works/ai-component-library/cover.webp",
      coverRatio: "3:4",
      images: [],
      currentVersion: "1.0",
      price: 0,
      isFree: true,
      figmaUrl: publicFigmaUrl,
      status: "PUBLISHED",
      categoryId: designCategory.id,
      authorId: admin.id,
      sortOrder: 0,
      tags: { connect: [{ id: aiApplicationTag.id }, { id: componentLibraryTag.id }] },
    },
  })

  console.log("两个公开案例已创建：个人建站工具、AI 组件库")

  console.log("数据库初始化完成！")
  console.log("")
  console.log("本地管理员账号:")
  console.log(`  邮箱: ${adminEmail}`)
  console.log(`  密码: ${adminPassword}`)
  console.log("")
  console.log("本地只读账户:")
  console.log(`  邮箱: ${viewerEmail}`)
  console.log(`  密码: ${viewerPassword}`)
  console.log("")
  console.log("这些账号仅用于本地开发，请勿直接用于公开环境。")
}

main()
  .catch((e) => {
    console.error("数据库初始化失败:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
