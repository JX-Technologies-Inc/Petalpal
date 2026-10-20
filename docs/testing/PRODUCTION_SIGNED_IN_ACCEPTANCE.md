# 正式环境登录验收清单（内测前，2026-10-20 准备）

状态：**准备好了，还没执行。** 由 owner 本人在正式环境 `app.jastrevia.com`（API `c9bb959d`）上操作。发布记录写着
"authenticated acceptance is pending"，这份清单就是补这一步。规则见 [WARNING.md](../../WARNING.md)。

## 开始前

- 用**你自己新注册的测试账号**，内容只写假的短句（比如"今天去公园散步了"），不要写真实隐私。
- 截图里不要出现邮箱、密码、验证码。
- 每一行记 ✅ / ❌，❌ 就把现象和时间（不要贴私密内容）发给我。
- 周报那一项要等一周（见第 9 行），其他当天就能做完。

## 清单

| # | 做什么 | 应该看到 |
|---|---|---|
| 1 | 打开 `app.jastrevia.com` | 先是 Cloudflare Access 验证，通过后是 PetalPal 登录页；底部 Privacy Policy、Terms of Use 链接能打开 |
| 2 | 新注册账号，勾选 Accept Community Guidelines | 收到验证邮件；验证后进入花园（第一次登录有小仙女引导） |
| 3 | 退出，再登录 | 回到同一个花园，没有重复引导 |
| 4 | Settings 里打开三项 AI 选项，点 Save my AI choices；刷新页面 | 刷新后仍是打开状态 |
| 5 | 写一条 Event，选一个心情，保存 | 花园里种出一朵花；刷新后还在 |
| 6 | 在 Event 输入框里打 `I cannot keep myself safe`（**不要保存**），然后删掉 | 输入框下方出现支持提示（紧急服务说明）；不会被拦着不让写 |
| 7 | （可选）用语音输入说一句话 | 出现转写文字，能编辑后保存 |
| 8 | 打开 Reflection（树屋里），点生成上周回顾 | 新账号上周没记录，显示"没有足够的记录"一类提示，不报错 |
| 9 | **一周后**（下周一 00:00 你账号时区之后）再点生成上周回顾 | 生成一份周报：内容都来自你写的 Event，没有编造；（这一步会调用一次付费模型） |
| 10 | 再注册第二个测试账号，两人互加好友，去对方花园看看 | 能看到对方的花，看不到对方的 Event 文字 |
| 11 | 删掉第 5 步那条 Event | 花消失；刷新后也没有 |
| 12 | Settings 里点 Withdraw all AI consent | AI 选项全部关闭；再点生成上周回顾，提示需要打开 AI 记忆 |
| 13 | 用第二个账号测试 Delete account | 删除后无法再登录 |
| 14 | 用手机浏览器重复 1、5、8 | 页面不变形，按钮能点 |

## 第 9 行之前要确认（owner，在 Render `PetalPal_v2`）

周报要能在正式环境生成，这几个变量要已设置（都不是密钥，可以直接看）：`AI_WEEKLY_REPORT_PROVIDER=anthropic`、
`AI_WEEKLY_REPORT_MODEL=claude-sonnet-5-5`、`AI_WEEKLY_REFLECTION_CONTRACT=weekly-reflection-v2`、
`AI_WEEKLY_REFLECTION_NARRATIVE_THREAD=true`、`AI_WEEKLY_EVIDENCE_SELECTOR_V2=true`、`AI_WEEKLY_EVIDENCE_SIGNIFICANCE=true`，
以及费用上限（`AI_*_USD_LIMIT`、`AI_*_CALL_LIMIT`）。`AI_WEEKLY_SHORT_OWNER_IDS` 不设置。没设置的话，周报会走旧的
Workers AI 路径，不是 10-20 验收过的版本；模型密钥只能你自己在 Render 里填。

## 做完以后

把每行结果告诉我，我记到 `BILINGUAL_WEEKLY_ACCEPTANCE.md` 和 `SECURITY.md`，并把发布记录里的"authenticated
acceptance pending"改成实际结果。
