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

1. **Render 后端**：部署后 `npm start` 会自动跑 `prisma migrate deploy`，会执行两个新迁移：
   `202610200001_fairy_moments`（新表 `FairyMoment`、`UserFairy.momentsSeenAt`）和
   `202610200002_fairy_moments_variety`（`spot`、`mood`，`photoKey` 可空）。只加表和列，不改旧数据。
2. **网页端**：重新构建并部署 Web（照片在 `mobile/assets/moments/`，随包发布）。

## 3. Render 环境变量

| 变量 | 值 | 必需 |
|---|---|---|
| `FAIRY_MOMENTS_OWNER_IDS` | 逗号分隔的 PetalPal **User id**（`user_…`，不是 Firebase UID）。先只放你自己 | 是 |
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

- 她在朋友圈里的活动按后端的日程算（`/api/fairy/runtime`），和花园里正在走动的花仙是两条线，
  不保证"刚看到她在喝茶，朋友圈就发喝茶"。
- 发帖时间按账号时区（注册时手机的时区）算，换时区不跟着变；显示时间按手机本地时间。
- 没有评论和回复（v2）。
- 本地没有 Postgres，后端在真实数据库上的完整流程没跑过；Haiku 从没真正调用过（测试都用模拟）。
