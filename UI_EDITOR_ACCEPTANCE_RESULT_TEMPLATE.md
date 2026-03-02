# UI Editor MVP 逐项验收结果模板

> 适用范围：`UI_EDITOR_PLAN copy.md`（MVP 阶段）
> 验收对象：`mole_chess_web`

## 1. 基本信息

- 验收日期：
- 验收人：
- 分支/版本号：
- 浏览器与版本：
- 设备环境（桌面/移动端）：
- 验收结论（通过/有条件通过/不通过）：

## 2. 结果判定规则

- `PASS`：符合计划要求，无阻塞问题。
- `FAIL`：不符合计划要求，存在阻塞问题。
- `N/A`：本次不适用（需填写原因）。

## 3. 逐项验收结果

| 编号 | 验收项 | 计划要求（摘要） | 结果（PASS/FAIL/N/A） | 证据（截图/日志/文件） | 问题描述（若FAIL） | 责任人 | 预计修复日期 | 复测结果 |
|---|---|---|---|---|---|---|---|---|
| A01 | 目录与文件 | `ui_editor/` 下具备 `editor.html/editor.js/editor.css/effects_engine.js/custom_theme.css` |  |  |  |  |  |  |
| A02 | 主页面样式链路 | `index.html` 已接入 `ui_editor/custom_theme.css` |  |  |  |  |  |  |
| A03 | 故事模式入口 | `index.html` 已新增故事模式 control-group，旧 UI 编辑器入口已移除 |  |  |  |  |  |  |
| A04 | 故事模式持久化 | `app.js` 使用 `mole_chess_story_mode_enabled` 并同步 `body[data-story-mode]` |  |  |  |  |  |  |
| A05 | 效果引擎接口 | `window.MoleChessEffects` 暴露 `triggerEvent/getConfig/setConfig/resetConfig/applyThemeCss` |  |  |  |  |  |  |
| A06 | 存储结构 | `mole_chess_effects_config`/`mole_chess_theme_css`/`mole_chess_ui_versions` 键可读写 |  |  |  |  |  |  |
| A07 | 事件别名映射 | `click_piece_select/click_cell_move/click_cell_capture/skill_critical` 映射生效 |  |  |  |  |  |  |
| A08 | 编辑器页面骨架 | 三栏布局+顶栏工具（保存/应用/备份/回滚/导出/导入）可用 |  |  |  |  |  |  |
| A09 | 预览通信 | `postMessage` 类型 `MC_EDITOR_APPLY_THEME/APPLY_EFFECTS/REQUEST_STATE/STATE_SYNC` 可工作 |  |  |  |  |  |  |
| A10 | 元素编辑能力 | MVP 元素清单可选中并编辑首批通用属性 |  |  |  |  |  |  |
| A11 | 事件配置能力 | MVP 事件清单可配置启用、音效、图片、类名、预设、音量、冷却 |  |  |  |  |  |  |
| A12 | 主题应用与持久化 | 编辑器应用后主页面刷新仍生效 |  |  |  |  |  |  |
| A13 | 版本管理 | 自动备份/命名备份/回滚可用，回滚后主题与事件一致恢复 |  |  |  |  |  |  |
| A14 | 导出导入 | JSON 导出后清空再导入可恢复一致 |  |  |  |  |  |  |
| A15 | 容量保护 | DataURL/总配置体积超阈值时阻止保存并提示 |  |  |  |  |  |  |
| A16 | 兼容性与空配置 | 无配置时无副作用；未配置事件触发不报错 |  |  |  |  |  |  |
| A17 | 移动端可用性 | <=900px 布局不重叠，核心按钮可操作 |  |  |  |  |  |  |
| A18 | 手测文档更新 | `MANUAL_TEST_CHECKLIST.md` 已新增 UI Editor MVP 章节 |  |  |  |  |  |  |

## 4. 关键场景实测记录（逐条）

| 场景编号 | 场景描述 | 预期结果 | 实际结果 | 结论 |
|---|---|---|---|---|
| S01 | `index.html` 与 `ui_editor/editor.html` 打开 | 页面可正常加载，无阻塞报错 |  |  |
| S02 | 调整 `:root --accent-color` | 预览即时生效，应用后刷新主页面仍生效 |  |  |
| S03 | `skill_success` 绑定特效 | 技能成功时出现对应效果 |  |  |
| S04 | 配置 `click_cell_move` | 实际 `move_start` 触发时效果生效 |  |  |
| S05 | 修改A→备份→修改B→回滚A | 主题与事件恢复到A |  |  |
| S06 | 导出→清空→导入 | 配置完全恢复 |  |  |
| S07 | 故事模式切换并刷新 | 状态保持，仅UI变化，不影响规则 |  |  |
| S08 | 窄屏编辑器操作 | 三栏不重叠，核心操作可执行 |  |  |
| S09 | 空配置/未配置事件 | 引擎无副作用，不报错 |  |  |

## 5. 问题清单（若有）

| 问题ID | 严重级别（P0/P1/P2/P3） | 问题描述 | 复现步骤 | 影响范围 | 临时方案 | 责任人 | 状态 |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |

## 6. 偏差说明（计划 vs 实际）

- 偏差项1：
- 偏差项2：
- 是否可接受：
- 结论依据：

## 7. 最终签署

- 开发负责人：
- 测试负责人：
- 产品/需求确认人：
- 签署日期：

