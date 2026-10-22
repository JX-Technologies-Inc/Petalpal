# PPL 亲密度 · 日历签到 · 信物 — 前端接口说明

后端已实现：[lib/fairy-closeness.js](../../lib/fairy-closeness.js)（规则）、[lib/fairy-keepsakes.js](../../lib/fairy-keepsakes.js)（45 个信物的名字和 PPL 的话）、
路由在 [server.js](../../server.js)。前端只需要调下面 5 个接口，加亲密度的大部分逻辑都在后端自动完成。

## 通用

- 地址：和其它接口一样走 `EXPO_PUBLIC_API_BASE_URL`，带登录 token（现有的 `apiRequest` 就行）。
- 开关：后端环境变量 `FAIRY_CLOSENESS_OWNER_IDS`（内测填 `*`）。**没开时所有接口返回 404**，前端看到 404 就隐藏亲密度入口和日历签到卡片。
- 语言：返回里的 `locale` 是 `en` 或 `zh-Hans`（跟用户设置里的语言走），信物名字、PPL 的话、称号已经按这个语言给好，前端直接显示。
- 「一天」按账号时区算（不是手机时区），日期都是 `YYYY-MM-DD` 字符串。

## 1. `POST /api/fairy/check-in` — 日历里的签到按钮

请求体为空或 `{}`（多传字段会 400）。每天只能签一次；**重复调用不会报错**，返回 `created: false` 和今天已经领到的信物，可以放心重试。

```json
{
  "created": true,
  "checkIn": { "localDate": "2026-10-22", "streak": 7, "graceUsed": false },
  "keepsakes": [
    { "id": "spider-thread", "rarity": "COMMON", "name": "蜘蛛丝线团", "note": "蜘蛛邻居送的，说可以用来缝星星。", "reason": "DAILY", "firstTime": true },
    { "id": "aurora-feather", "rarity": "RARE", "name": "极光羽毛", "note": "拿在谁手里，它的颜色就不一样。", "reason": "STREAK_7", "firstTime": true }
  ],
  "awarded": 30,
  "levelUp": { "level": 3, "title": "渐渐熟悉" },
  "locale": "zh-Hans"
}
```

- `keepsakes`：今天领到的信物，通常 1 个，最多 3 个。按顺序弹出就行。
  - `reason`：`DAILY` 每日 / `STREAK_7` 连签第 7 天 / `MONTHLY` 本月限定 / `SPECIAL` 满级纪念。
  - `firstTime`：`true` 时可以加个「新收集」标记。
- `awarded`：这次加了多少亲密度，用来显示「亲密度 +10」。
- `levelUp`：升级了才有，不是 null 时弹「升级到 Lv3 · 渐渐熟悉」。
- `graceUsed: true`：表示昨天漏签、用掉了本周的「PPL 帮你留着」。可以提示一句「PPL 帮你把连签留住了」。

## 2. `GET /api/fairy/check-ins?month=YYYY-MM` — 日历上的签到标记

`month` 不传就是本月。只返回签过到的日子：

```json
{
  "locale": "zh-Hans", "month": "2026-10", "today": "2026-10-22",
  "days": [
    { "localDate": "2026-10-21", "streak": 6, "graceUsed": false, "keepsakes": [{ "id": "glowing-petal", "reason": "DAILY" }] },
    { "localDate": "2026-10-22", "streak": 7, "graceUsed": false, "keepsakes": [{ "id": "spider-thread", "reason": "DAILY" }, { "id": "aurora-feather", "reason": "STREAK_7" }] }
  ]
}
```

日历翻月时用 `month` 参数取那个月的数据。

## 3. `GET /api/fairy/closeness` — 亲密度页面 + 日历签到卡片

```json
{
  "locale": "zh-Hans", "localDate": "2026-10-22",
  "level": 3, "title": "渐渐熟悉", "total": 101,
  "pointsIntoLevel": 16, "pointsForNextLevel": 65,
  "nextTitle": { "level": 5, "title": "花园好友" },
  "maxed": false,
  "today": [
    { "source": "CHECK_IN", "count": 1, "dailyCap": 1, "points": 10, "pointsEach": 10 },
    { "source": "STREAK_7", "count": 1, "dailyCap": 1, "points": 20, "pointsEach": 20 },
    { "source": "EVENT", "count": 2, "dailyCap": 3, "points": 10, "pointsEach": 5 },
    { "source": "MOMENT_LIKE", "count": 0, "dailyCap": 3, "points": 0, "pointsEach": 2 },
    { "source": "FAIRY_TAP", "count": 1, "dailyCap": 5, "points": 1, "pointsEach": 1 },
    { "source": "WEEKLY_READ", "count": 0, "dailyCap": 1, "points": 0, "pointsEach": 15 }
  ],
  "checkIn": { "checkedInToday": true, "streak": 7, "graceAvailable": true, "checkInsToStreakReward": 7 },
  "monthly": { "month": "2026-10", "checkIns": 7, "needed": 20, "earned": false,
    "keepsake": { "id": "crocus-brooch", "rarity": "MONTHLY", "name": "番红花胸针", "month": 10 } },
  "collection": { "owned": 8, "total": 45 },
  "unlocks": [
    { "level": 3, "key": "MOMENTS_FOR_YOU", "status": "coming_soon", "unlocked": true },
    { "level": 5, "key": "MORE_RARE_KEEPSAKES", "status": "live", "unlocked": false },
    { "level": 8, "key": "MAILBOX_LETTERS", "status": "coming_soon", "unlocked": false },
    { "level": 12, "key": "AVATAR_FRAME", "status": "live", "unlocked": false },
    { "level": 16, "key": "EASIER_MONTHLY_KEEPSAKE", "status": "live", "unlocked": false },
    { "level": 20, "key": "FOREVER_KEEPSAKE", "status": "live", "unlocked": false }
  ]
}
```

- **进度条**：`pointsIntoLevel / pointsForNextLevel`，例如「16 / 65，再 49 点升 Lv4」。
  - `maxed: true` 时，`pointsForNextLevel` 是 null，显示满级。
- `nextTitle` 是下一个**称号**（不一定是下一级），比如「Lv5 解锁 花园好友」。
- `today`：每一行显示成「写心情 2/3」这种，即 `count` / `dailyCap`。
  - `STREAK_7` 只在连签第 7 天才会有，平时可以不显示这一行。
- **日历签到卡片**用 `checkIn` 这一组：
  - `checkedInToday`：决定按钮显示「签到」还是「今天已签到」。
  - `streak`：已连签天数。
  - `checkInsToStreakReward`：还要签几次才拿到稀有信物，等于 1 时显示「明天/今天签到必得稀有信物」。
  - `graceAvailable`：本周的「PPL 帮你留着」还没用掉。
- `monthly`：本月限定信物的进度，例如「本月已签 7 / 20 天，签满得番红花胸针」。`earned: true` 表示已经拿到。
- `unlocks`：等级解锁。`status: "coming_soon"` 的显示「即将开放」。`AVATAR_FRAME`（Lv12 头像框）由前端根据 `unlocked` 自己画。

## 4. `GET /api/fairy/keepsakes` — 信物收藏册

返回全部 45 个信物，没拿到的也会返回，用来显示灰色剪影。**没拿到的不带 `note`**，PPL 的话要拿到后才能看见。

```json
{
  "locale": "zh-Hans", "owned": 8, "total": 45,
  "keepsakes": [
    { "id": "glowing-petal", "rarity": "COMMON", "name": "会发光的花瓣", "note": "晚上它会微微亮，像一盏很小的灯。", "owned": true, "count": 1, "firstLocalDate": "2026-10-21" },
    { "id": "dewdrop", "rarity": "COMMON", "name": "清晨露珠", "owned": false, "count": 0, "firstLocalDate": null }
  ]
}
```

排序固定：普通 24 → 稀有 8 → 每月限定 12（按 1–12 月，带 `month`）→ 满级 1。

## 5. `POST /api/fairy/closeness/tap` — 点了花园里的 PPL

在花园里点到 PPL 本人时调一次。请求体为空。每天最多算 5 次，超出后返回 `awarded: 0`，不会报错。

```json
{ "awarded": 1, "levelUp": null, "keepsake": null }
```

`keepsake` 只在刚好升到满级时才会有，内容是满级纪念信物。

## 后端自动加的亲密度（前端不用调）

| 行为 | 加多少 | 每天上限 | 在哪里加 |
|---|---|---|---|
| 签到 | +10 | 1 | `POST /api/fairy/check-in` |
| 连签第 7 天 | +20 | 1 | 同上 |
| 写心情 | +5 | 3 | `POST /events` 创建成功时 |
| 给 PPL 朋友圈点赞 | +2 | 3 | `POST /api/fairy/moments/:id/like`（同一条帖子只算一次） |
| 点 PPL | +1 | 5 | `POST /api/fairy/closeness/tap` |
| 打开周报 | +15 | 1 | `GET /ai/reports/weekly/:id`（同一份周报只算一次） |

前端在写完心情、点完赞、看完周报回到页面后，重新拉一次 `GET /api/fairy/closeness` 就能看到最新数值。

## 等级

升下一级需要 `20 + 15 × 当前等级` 点：Lv1→2 要 35 点，Lv10→11 要 170 点，Lv19→20 要 305 点，满级 Lv20 一共 3,230 点。

| 等级 | 称号（中 / 英） |
|---|---|
| 1–2 | 初次相遇 / First hello |
| 3–4 | 渐渐熟悉 / Getting to know you |
| 5–7 | 花园好友 / Garden friends |
| 8–11 | 心事伙伴 / Kindred hearts |
| 12–15 | 知心花友 / Flower confidants |
| 16–19 | 默契知己 / In tune |
| 20 | 一生花伴 / Forever companions |

## 信物图片

前端用信物的 `id` 对应图片，名字和文字都以后端返回为准。全部 id 和中英文名字见 [lib/fairy-keepsakes.js](../../lib/fairy-keepsakes.js)。
美术出图前可以先用图标代替，建议按 `rarity` 区分边框颜色。

## 错误

| 状态码 | 含义 |
|---|---|
| 404 | 功能没开，或者账号没有资料 |
| 400 | `month` 格式不对，或者签到、点击接口多传了字段 |
| 401 | 没登录 |
| 500 | 服务器出错，可以稍后重试 |

签到可以安全重试，不会重复发信物。
