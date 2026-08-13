/**
 * 留言板示例数据：仅当留言为空时插入若干示例（含访客留言 + 博主回复），避免页面空荡、方便预览便签墙。
 * 幂等：已有留言则跳过。本地 `npx tsx prisma/seed-guestbook.ts`；生产部署后同样执行一次即可。
 * 注：这些是示例，上线后可在后台「来坐坐留言」里随意删除。
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// 顶层留言；reply 为可选的博主回复
const SAMPLES: { nickname: string | null; content: string; reply?: string }[] = [
  {
    nickname: "路过的小猫",
    content: "好喜欢这个小角落，布置得真用心 🐱✨ 第一次来，先留个脚印～",
    reply: "谢谢你来坐坐～喜欢的话常来玩呀 ☕",
  },
  {
    nickname: "设计系小学妹",
    content: "学姐的作品集太治愈了，看完元气满满！想问问转行设计有什么建议吗？🥺",
    reply: "先从临摹 + 复盘开始，别怕做丑稿，多做多改就有手感啦，加油 💪",
  },
  { nickname: "coffeeLover", content: "为了那杯咖啡 emoji 点进来的 ☕ 没想到内容这么干货 👍" },
  { nickname: "阿哲", content: "那篇设计复盘看了三遍，受益匪浅 🙏 期待更新！" },
  { nickname: "Mia", content: "Love the cozy vibe here! Greetings from Singapore 🌏✨" },
  { nickname: null, content: "默默留个言，祝越来越好 🌟" },
  {
    nickname: "老王",
    content: "网站做得真精致，想知道用什么搭的？",
    reply: "Next.js + Tailwind，前后台一把梭 😄",
  },
]

async function main() {
  const count = await prisma.guestbookMessage.count()
  if (count > 0) {
    console.log(`已有 ${count} 条留言，跳过示例插入`)
    return
  }
  let n = 0
  for (const s of SAMPLES) {
    const top = await prisma.guestbookMessage.create({
      data: { nickname: s.nickname, content: s.content, isOwner: false },
    })
    n++
    if (s.reply) {
      await prisma.guestbookMessage.create({
        data: { nickname: "站长", content: s.reply, isOwner: true, parentId: top.id },
      })
      n++
    }
  }
  console.log(`示例留言已插入：共 ${n} 条`)
}

main()
  .catch((e) => {
    console.error("插入示例留言失败:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
