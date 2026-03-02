# Mole Chess AI 人工手测必做步骤

本文是当前 AI V2（Worker + 搜索 + 遥测 + 回退链）上线前必须执行的人工测试指引。

## 0. 测试准备（必须）

1. 清理浏览器本地存储（至少清理当前站点的 `localStorage`）。
2. 重新打开 `index.html`，确认 AI 日志面板内可见调试信息：
   - `Engine`
   - `Model`
   - `Build`
   - `Neural`
3. 打开控制台，确认无 `MoleChessCore not found`、`AI worker unavailable` 级别错误。

## 1. 基础可用性（必须）

1. 勾选 `AI 模式（人机）`，开始一局。
2. 等到黑方 AI 回合，观察是否正常行动并结束回合。
3. 验证 `/api/ai_move` 扩展字段在前端生效：
   - AI 日志正常追加
   - 调试面板数据有变化（Fallback / Avg Think / Skill Rate）

通过标准：AI 能连续走至少 20 手，不出现“AI 卡住”。

## 1.1 鼹鼠地道技能阻断回归（必须）

1. 选择鼹鼠技能 `热爱洞洞`，先完成 `tunnel_roll` 判定并确保成功。
2. 按顺序选择传送目标 -> 地道起点 -> 地道终点。
3. 点击合法蓝点终点，确认技能成功执行且可以正常结束回合。
4. 故意点两次非法终点，确认只提示路径校验错误，并且仍停留在“终点重选”。
5. 在判定成功后中断地道流程（切换其他操作），再点击终点，确认提示“需重新发动技能”，且不会卡成“本回合已行动”死状态。

通过标准：
- 不再出现“技能失败、本回合已行动”与“地道路径无效”同时冲突提示；
- 地道流程可重试、可退出、可重新发动。

## 2. AI vs AI 连续对局稳定性（必须）

1. 勾选 `观战模式（AI 对 AI）`。
2. 连续观战至少 3 局（每局至少 30 手）。
3. 每局结束后记录：
   - 是否出现异常中断
   - 调试面板 `Fallbacks` 增量
   - 调试面板最近决策中的 `r#`（repeatStreak）与 `sig=...` 摘要
   - 控制台是否有 Worker error

通过标准：
- 无崩溃/死循环；
- 20 回合窗口内 `repeatStreak` 不应超过 2；
- 20 回合窗口动作签名多样性占比应 >= 60%；
- 3 局内不应频繁进入随机兜底（仅偶发）。

## 3. 回退链验证（必须）

1. 在浏览器 DevTools 的 Network/Source 中临时阻断 `ai/worker/ai_worker.js`（或改名模拟加载失败）。
2. 再次进行 AI 回合，观察：
   - AI 仍能行动（应回退到规则池/legacy）
   - 调试面板 `Fallbacks` 递增
3. 恢复 worker 资源后刷新页面，再验证回到 Worker 决策。

通过标准：
- Worker 失效时对局不中断；
- 回退计数可观测。

## 4. 一致性手测（PC vs 手机，必须）

1. PC 与手机打开同一版本构建（普通版或同一个 `mole_chess_portable.html`）。
2. 在 PC 上先走到一个中盘局面（建议 10~15 手），导出状态：
   - 打开控制台执行：
     ```js
     fetch('/api/ai_debug_export_state', {method:'POST'}).then(r=>r.json()).then(console.log)
     ```
   - 复制 `serialized_game`。
3. 在 PC 与手机分别执行同一请求（贴入同一 `serializedGame` 与同一 config）：
   ```js
   fetch('/api/ai_debug_decide', {
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body: JSON.stringify({
       modeHint:'ai_vs_ai',
       config:{engineVersion:'v2', difficulty:'hard', deterministicSeed:20260220, enableNeuralEval:true, enableFallback:true},
       serializedGame: /* 粘贴同一份 */
     })
   }).then(r=>r.json()).then(console.log)
   ```
4. 对比两端 `action` 与 `fallback_level`。

通过标准：同一快照 + 同配置 + 同 seed，动作应一致（重复 20 个快照至少 19 个一致）。

## 5. 性能手测（必须）

1. 手机端进行 `expert` 档 AI vs AI（可通过请求体 config 指定）。
2. 记录 20 次 AI 决策的 `think_ms`（控制台返回或面板统计）。

通过标准：平均 `think_ms <= 5000ms`，交互不卡死。

## 6. portable 离线验证（必须）

1. 断网（或飞行模式）打开 `mole_chess_portable.html`。
2. 开始 AI 对局，观察 10 手以上。
3. 检查调试面板是否显示 `Build/Model/Engine`，且 AI 正常行动。

通过标准：离线可完整运行，AI 可连续决策。

## 7. 回归点（必须）

1. 验证关键技能局面下 AI 执行结果合法：
   - 警察抓捕
   - 夜魔技能
   - 市民升变
   - 鼹鼠技能
2. 确认 AI 行动仍通过原规则执行（无非法穿透、无规则破坏）。

通过标准：不出现与 `Game.applyMove/use_skill` 规则冲突的动作。

## 8. 发布前记录（必须）

1. 记录版本信息：`Engine/Model hash/Build timestamp`。
2. 记录 KPI 样例：
   - 一致率
   - fallback 率
   - expert 平均思考时间
3. 记录回滚开关：`mole_chess_ai_config.engineVersion='v1'`。

---

如果任一“必须”步骤不通过，不建议发布。
