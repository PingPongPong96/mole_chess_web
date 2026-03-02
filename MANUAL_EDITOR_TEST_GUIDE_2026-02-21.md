# Manual Editor Test Guide (2026-02-21)

## 1. 先清理本地数据（建议）
1. 打开 `portal/settings.html`。
2. 点击“清理故事数据（V1/V2）”和“清理关卡草稿”。
3. 预期：状态栏提示清理成功。

## 2. UI 编辑器基础检查（`ui_editor/editor.html`）
1. 打开页面，确认能看到 Surface 切换、预览比例、safe-area 开关。
2. 依次切换 Surface：`index`、`main_menu`、`story_mode`。
3. 每次切换都点“刷新预览”。
4. 预期：iframe 分别加载 `index`、`portal/main_menu.html`、`portal/story_mode/story.html`。

## 3. UI 编辑器比例预览检查
1. 在同一 Surface 下切换比例预设：16:9、16:10、4:3、9:16、Custom。
2. Custom 输入例如 `1280 x 720`、`1080 x 1920`。
3. 开关 safe-area 显示。
4. 预期：预览区域按比例缩放，safe-area 虚线正常显示/隐藏。

## 4. UI 编辑器样式编辑检查
1. 在 `index` Surface 选 `.game-title` 改颜色和阴影，点击“应用”。
2. 在 `main_menu` Surface 选 `.menu-btn` 改背景色，点击“应用”。
3. 在 `story_mode` Surface 选 `.story-panel` 改边框色，点击“应用”。
4. 预期：三个页面分别生效，互不串改。

## 5. UI 编辑器事件配置检查
1. 在 `index` Surface 选事件 `move_start`，设置 `overlayPreset=shake-screen`。
2. 保存后去 `index.html` 走一步棋。
3. 预期：触发屏幕抖动。
4. 在 `main_menu`/`story_mode` Surface 配置事件后不应影响对局事件触发（仅主题样式生效）。

## 6. UI 编辑器版本管理检查
1. 创建备份A，改样式再创建备份B。
2. 回滚到备份A。
3. 导出 JSON，再导入。
4. 预期：版本可切换，导入后配置保持一致。

## 7. 故事编辑器基础检查（`portal/story_editor/editor.html`）
1. 确认五个标签可切换：剧情图、关卡、触发器、资源库、文本导入导出。
2. 点击“加载 V2 工程”“保存工程”“导出 JSON”“导入 JSON”。
3. 预期：状态栏提示正确，无报错卡死。

## 8. 剧情图编辑检查
1. 新增章节、新增节点。
2. 节点类型分别测试 `dialogue`、`choice`、`battle`、`jump`、`end`。
3. 填写节点字段并保存，再切换节点再切回。
4. 预期：字段持久化正确，删除节点后列表刷新正确。

## 9. 内嵌关卡编辑器检查（故事编辑器“关卡”标签）
1. 在棋盘中放置棋子、右键移除、Alt+点击清空。
2. 保存为关卡A，再改盘面保存为关卡B。
3. 选择关卡A加载，确认盘面恢复。
4. 预期：关卡快照可保存/加载/删除，状态字段（回合、阵营、日志等）可带入。

## 10. 触发器编辑检查（AoE）
1. 新增触发器，设置 `logic=ALL`、`policy=once`。
2. 条件填写如 `turn_at_least`、`flag_equals`，效果填写 `set_flag`、`goto_node`。
3. 保存后切换其他触发器再切回。
4. 预期：JSON可保存，列表状态正确。

## 11. 资源库检查（路径引用）
1. 分别新增背景、BGM、SFX、立绘资源。
2. 点击列表项回填表单，再修改保存。
3. 预期：资源按类型存储，路径与备注正确更新。

## 12. DSL 导入导出检查
1. 点击“从节点导出 DSL”，确认文本生成。
2. 清空后粘贴示例 DSL 再“导入为节点”。
3. 返回剧情图查看节点是否生成。
4. 预期：`@label/@jump/@choice/@bg/@bgm/@sfx/@portrait` 能转为节点数据。

## 13. 故事模式运行时检查（`portal/story_mode/story.html`）
1. 点击“加载本地工程”。
2. 测试对话推进、选项分支、跳转节点。
3. 到 battle 节点时确认右侧 iframe 战斗区状态变化。
4. 预期：剧情能推进，战斗节点可加载快照，战斗结束后可继续触发流程。

## 14. 故事模式触发器运行检查
1. 在编辑器设置可观测触发器（如 `set_flag` + `show_overlay_text`）。
2. 在故事模式推进到触发时机。
3. 观察触发反馈面板。
4. 预期：显示“命中/未命中”与执行日志，`goto_node` 能生效。

## 15. 入口与下线检查
1. 打开 `portal/settings.html`，确认无“独立棋盘关卡编辑器”入口。
2. 打开 `portal/story_editor/board_editor.html`。
3. 预期：显示“已下线”提示并引导到 `editor.html#tab-levels`。

## 16. 不影响主对局机制回归（关键）
1. 打开 `index.html`，进行正常开局、移动、吃子、技能、结束回合。
2. 验证重点机制（如夜魔、警察、鼹鼠等）至少各测1次。
3. 预期：规则行为与改造前一致，无新增规则异常。

---

## 记录模板（每项都写）
1. 测试项
2. 操作步骤
3. 实际结果
4. 预期结果
5. 结论（通过/失败）
6. 失败时附截图与控制台报错
