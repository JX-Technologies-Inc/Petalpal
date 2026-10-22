# 花仙朋友圈（Fairy Moments）上线清单（2026-10-21）

状态：**代码已在本地完成，未推送、未部署。** 下面每一步都只能由 owner 来做。
默认关闭：不设 `FAIRY_MOMENTS_OWNER_IDS` 时，后端和 App 的行为和现在完全一样。

## 1. 分支（四个提交，依次叠在一起）

| 提交 | 分支 | 内容 |
|---|---|---|
| `86beb071` | `feat/fairy-moments-backend` | 后端：表、发帖规则、`GET /api/fairy/moments`、点赞、开关 |
| `f732a02c` | `feat/fairy-moments-captions` | Haiku 写文案，失败用预写文案 |
| `0d445acf` | `feat/fairy-moments-variety` | 散步、晚安、多张照片、纯文字小发现、花仙心情 |
| `89161876` | `feat/fairy-moments-mobile` | App：花仙图标红点、朋友圈面板、20 张照片、生成脚本 |

最省事：推送 `feat/fairy-moments-mobile`，开一个 PR 合进 `main`（四个提交一起）。
想分开审：按上表顺序开四个 PR，每个基于上一个分支。

## 2. 部署

1. **数据库迁移（手动，必须在部署后端之前）**：正式环境 Render 的 Docker Command 是 `node server.js`，
   部署**不会**跑迁移（见 [INTEGRATION_DEPLOYMENT.md](../../INTEGRATION_DEPLOYMENT.md) §2、§6）。
   先 `pg_dump` 备份，再从合并后的那个提交的干净代码上，用正式库的直连（非 pooled）地址跑一次
   `npx prisma migrate deploy`。会执行两个新迁移：
   `202610200001_fairy_moments`（新表 `FairyMoment`、`UserFairy.momentsSeenAt`）和
   `202610200002_fairy_moments_variety`（`spot`、`mood`，`photoKey` 可空）。只加表和可空列，不改旧数据，
   旧后端照常运行，不用暂停服务。顺序不能反：新后端读 `UserFairy` 会带上 `momentsSeenAt`，
   没迁移就部署，花仙相关接口都会报错（不管朋友圈开没开）。
2. **Render 后端**：迁移完成后，用 Deploy a specific commit 部署合并后的那个提交；
   Dockerfile Path 保持 `./Dockerfile.backend`，Docker Command 保持 `node server.js`。
3. **网页端**：按 INTEGRATION_DEPLOYMENT.md §4 构建、上传、启用 Web（照片在 `mobile/assets/moments/`，随包发布）。

## 3. Render 环境变量

| 变量 | 值 | 必需 |
|---|---|---|
| `FAIRY_MOMENTS_OWNER_IDS` | 逗号分隔的 PetalPal **User id**（`user_…`，不是 Firebase UID），不能有空格；或者只填 `*`，表示所有登录用户（内测站点在 Cloudflare Access 后面，等于所有内测用户）。同一份名单也控制花园里的小花仙跟着作息走 | 是 |
| `AI_FAIRY_MOMENT_MODEL` | `claude-haiku-5-5`。不设就一直用预写文案 | 否 |
| `AI_FAIRY_MOMENT_DAILY_LIMIT` | 每人每天最多几次 Haiku 调用，默认 6；`0` 等于关掉 | 否 |

AI 文案还需要现有的 Anthropic 网关开关和预算变量已经打开（和 Event 情绪分析用的是同一套）。
User id 的查法：登录网页端，在浏览器开发者工具 Network 里看 `GET /session` 返回的 `id`。

## 4. 验收（正式环境，只用你自己的账号）

1. 设好 `FAIRY_MOMENTS_OWNER_IDS` 后打开花园：点花仙图标应该打开朋友圈面板（不再只是移动镜头）。
   面板右上角 "Find her" 会关掉面板并把镜头移到她身上。
2. 第一次打开是空的：她的帖子从这之后的活动里产生，按规则通常一两天内出现第一条
   （之后至少隔 48 小时，每 7 天最多 3 条）。有新帖时花仙图标上有红点，打开面板后消失。
3. 看一条带图的、一条纯文字的；点赞再取消。
4. 名单外的账号：花仙图标的行为不变，`GET /api/fairy/moments` 返回 404。

## 5. 已知限制

- 她的日程按账号时区走：每晚 22:00–06:00 睡觉，白天不睡；大约五晚有一晚熬夜玩到 23:30–01:00，
  第二天 07:30 起。名单里的用户进花园时，她直接出现在日程对应的位置（喝茶、秋千、月亮床、树屋里、
  信箱旁、在小路上散步）；看着时到了换状态的时间，她会自己过去；点了她以后先听你的，一分钟后回到日程。
  信箱状态只站在旁边，不自动拆信。
- 发帖时间按账号时区（注册时手机的时区）算，换时区不跟着变；显示时间按手机本地时间。
- 面板上的文字、时间和地点跟用户选的语言走（设置里的周报语言：English / 简体中文，和她的文案一致）；
  `GET /api/fairy/moments` 返回 `locale`。App 其他界面目前仍只有英文。
- 她的朋友圈头像单独选，跟用户自己的头像没关系：面板里点她的头像，从头像库（`lib/avatars.js`，8 张）里选，
  或者选回她原来那张喝茶照。存在 `UserFairy.momentsAvatar`（迁移 `202610220001_fairy_moments_avatar`），
  `PUT /api/fairy/moments/avatar {avatar: "fairy-1"…"fairy-8" | null}`，只接受头像库里的 id；
  `GET /api/fairy/moments` 的 `fairy.avatar` 返回当前选择（null = 原照片）。
- 她在树屋里时人是藏在门后的（没有坐在树屋里的画），所以树屋窗户会更亮，门上方有一个气泡
  「小花仙在树屋里 ✨ / 点一下叫她出来」，点了她就走出来。
- 没有评论和回复（v2）。
- 本地没有 Postgres，后端在真实数据库上的完整流程没跑过；Haiku 从没真正调用过（测试都用模拟）。
