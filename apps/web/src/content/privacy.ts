import type { Locale } from "@ai-learn/shared";

/**
 * 隐私政策（泰国 PDPA）。初稿，上线收费前请法律顾问审阅；泰文需母语者审校。
 * {email} 会替换成 NEXT_PUBLIC_CONTACT_EMAIL。
 */
export const PRIVACY: Record<Locale, { title: string; updated: string; sections: Array<{ h: string; p: string[] }> }> = {
  th: {
    title: "นโยบายความเป็นส่วนตัว",
    updated: "ปรับปรุงล่าสุด: 1 พฤศจิกายน 2569",
    sections: [
      { h: "ข้อมูลที่เราเก็บ", p: [
        "ข้อมูลบัญชีจาก LINE หรือ Google ที่คุณอนุญาต: รหัสผู้ใช้ ชื่อ และอีเมล (ถ้ามี)",
        "ความคืบหน้าการเรียน: บทที่เรียนจบ คะแนน คะแนนประสบการณ์ และจำนวนวันที่เรียนต่อเนื่อง",
        "สถิติการใช้ AI: จำนวนครั้งและปริมาณการใช้งาน (เพื่อคุมค่าใช้จ่าย) เราไม่บันทึกข้อความที่คุณพิมพ์ในช่องฝึก",
        "อีเมลที่คุณฝากไว้เพื่อรับข่าวสาร",
      ] },
      { h: "เราใช้ข้อมูลเพื่ออะไร", p: [
        "ให้คุณเข้าสู่ระบบ บันทึกความคืบหน้า และใช้สมาชิกได้ทั้งบนเว็บและแอป",
        "ส่งคำสั่งที่คุณพิมพ์ในช่องฝึกไปให้ผู้ให้บริการ AI (Anthropic) เพื่อสร้างคำตอบและคะแนน แล้วแสดงให้คุณเห็นทันที",
        "แจ้งข่าวบทเรียนใหม่ทางอีเมล (เฉพาะคนที่ลงชื่อไว้)",
        "เราไม่ขายข้อมูลของคุณ และไม่นำข้อความที่คุณฝึกไปใช้อย่างอื่น",
      ] },
      { h: "การชำระเงิน", p: ["การชำระเงินผ่านเว็บดำเนินการโดย Stripe เราไม่เห็นและไม่เก็บเลขบัตรของคุณ"] },
      { h: "การเก็บข้อมูลในเบราว์เซอร์", p: ["เราเก็บโทเคนเข้าสู่ระบบและภาษาที่เลือกไว้ในเบราว์เซอร์ของคุณ ไม่มีคุกกี้โฆษณา"] },
      { h: "สิทธิ์ของคุณ", p: [
        "คุณขอดู แก้ไข หรือขอสำเนาข้อมูลได้ทางอีเมล {email}",
        "คุณลบบัญชีได้เองที่หน้า \"บัญชีของฉัน\" ข้อมูลการเรียนและสถิติจะถูกลบทันที และการสมัครสมาชิกผ่านเว็บจะถูกยกเลิก",
      ] },
      { h: "ติดต่อเรา", p: ["หากมีคำถามเรื่องความเป็นส่วนตัว ติดต่อ {email}"] },
    ],
  },
  zh: {
    title: "隐私政策",
    updated: "最后更新：2026 年 11 月 1 日",
    sections: [
      { h: "我们收集哪些信息", p: [
        "你授权的 LINE 或 Google 账户信息：用户 ID、名字和邮箱（如有）",
        "学习进度：完成的课程、得分、经验值和连续学习天数",
        "AI 使用统计：次数和用量（用于控制成本）。我们不保存你在练习框里输入的内容",
        "你留下的用于接收通知的邮箱",
      ] },
      { h: "我们如何使用这些信息", p: [
        "让你登录、保存进度，并在网站和 App 上使用会员",
        "把你在练习框里写的提示词发给 AI 服务商（Anthropic）生成回答和评分，并立即展示给你",
        "通过邮件通知新课程（仅限订阅了通知的用户）",
        "我们不出售你的信息，也不把你的练习内容用于其他用途",
      ] },
      { h: "付款", p: ["网站付款由 Stripe 处理，我们看不到也不保存你的银行卡号"] },
      { h: "浏览器存储", p: ["我们在你的浏览器里保存登录凭证和所选语言，没有广告 Cookie"] },
      { h: "你的权利", p: [
        "你可以通过邮件 {email} 查看、更正或索取你的数据副本",
        "你可以在「我的账户」页面自行删除账户，学习记录和统计会立即删除，网站上的订阅也会取消",
      ] },
      { h: "联系我们", p: ["有关隐私的问题请联系 {email}"] },
    ],
  },
  en: {
    title: "Privacy policy",
    updated: "Last updated: 1 November 2026",
    sections: [
      { h: "What we collect", p: [
        "Account details from LINE or Google that you allow: your user ID, name and email (if provided)",
        "Learning progress: lessons completed, scores, XP and your streak",
        "AI usage statistics: number of uses and volume (to control costs). We don't store what you type in the practice box",
        "Your email, if you sign up for updates",
      ] },
      { h: "How we use it", p: [
        "To log you in, save your progress and let you use your membership on the website and the app",
        "To send the prompt you write in a practice box to our AI provider (Anthropic) to generate an answer and a score, shown to you right away",
        "To email you about new lessons (only if you signed up)",
        "We don't sell your data and don't use your practice prompts for anything else",
      ] },
      { h: "Payments", p: ["Website payments are handled by Stripe. We never see or store your card number"] },
      { h: "Browser storage", p: ["We keep your login token and chosen language in your browser. There are no advertising cookies"] },
      { h: "Your rights", p: [
        "You can ask to see, correct or get a copy of your data by emailing {email}",
        "You can delete your account yourself on the \"My account\" page. Your learning data is deleted immediately and any website subscription is cancelled",
      ] },
      { h: "Contact", p: ["Questions about privacy: {email}"] },
    ],
  },
};
