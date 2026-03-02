# 鼹鼠棋可视化UI自定义编辑器

为鼹鼠棋Web版构建一个独立的可视化UI编辑器，支持编辑游戏界面元素、绑定交互事件效果、上传自定义媒体资源，并提供版本备份与回滚功能。

## User Review Required

> [!IMPORTANT]
> 本编辑器构建在 `g:\mole_chess_web\ui_editor\` 目录下，通过独立的 `editor.html` 入口访问，**不会在主游戏页面显示编辑器UI**。编辑器对主项目的修改限于 `style.css` 相关的CSS自定义变量和事件效果配置。

> [!WARNING]
> 由于是纯前端项目（无后端服务器），版本备份使用 `localStorage` + 文件下载/导入的方式实现。CSS修改通过注入自定义样式覆盖原有样式来实现，不直接修改 `style.css` 源文件，而是生成一个 `ui_editor/custom_theme.css` 并在 `index.html` 中引用。

---

## Proposed Changes

### UI Editor Core（新建目录 `ui_editor/`）

编辑器页面为独立入口，与游戏主页面完全分离。

#### [NEW] [editor.html](file:///g:/mole_chess_web/ui_editor/editor.html)
编辑器主页面，包含：
- **左侧面板（30%宽度）**：元素列表树 + 事件列表
- **中央面板（45%宽度）**：游戏页面实时预览（iframe嵌入 `index.html`）
- **右侧面板（25%宽度）**：属性编辑器 + CSS编辑器
- 顶部工具栏：保存、应用、版本备份、回滚、导出/导入

#### [NEW] [editor.css](file:///g:/mole_chess_web/ui_editor/editor.css)
编辑器自身的样式，沿用鼹鼠棋的赛博朋克视觉风格（暗背景+荧光色）。

#### [NEW] [editor.js](file:///g:/mole_chess_web/ui_editor/editor.js)
编辑器核心逻辑，约2000行，包括以下模块：

**1. 元素编辑器**（可编辑的游戏界面大元素清单）：

| 元素 | CSS选择器 | 可编辑属性 |
|------|-----------|-----------|
| 游戏标题 | `.game-title` | 位置、大小、字体、颜色、背景图 |
| 侧边栏 | `.sidebar` | 宽度、背景色/图、边框、透明度 |
| 状态面板 | `.status-panel` | 位置、大小、背景、字体颜色 |
| 系统日志 | `.log-panel` | 位置、大小、背景、字体颜色 |
| AI日志 | `.ai-log-panel` | 位置、大小、背景 |
| 幽灵区 | `.ghost-panel` | 位置、大小、背景 |
| 拘留区 | `.detention-panel` | 位置、大小、背景 |
| 控制面板 | `.controls-panel` | 位置、大小、按钮样式 |
| 设置面板 | `.config-panel` | 位置、大小、背景 |
| 棋盘区域 | `.game-area` | 背景色/图 |
| 棋盘格子 | `.board-grid` | 大小、边框颜色、间距 |
| 棋盘坐标 | `.board-coordinates-top`, `.board-coordinates-left` | 字体、颜色 |
| 单元格 | `.cell` | 大小、背景色、边框 |
| 棋子 | `.piece` | 大小、字体大小、边框样式、背景渐变 |
| 棋子（黑方） | `.piece.team-black` | 背景、边框色、文字颜色 |
| 棋子（白方） | `.piece.team-white` | 背景、边框色、文字颜色 |
| 棋子（中立） | `.piece.team-neutral` | 背景、边框色、文字颜色 |
| 墓碑效果 | `.piece.grave` | 滤镜、透明度、背景色 |
| 幽灵效果 | `.piece.ghost` | 透明度、背景色、动画 |
| 夜魔效果 | `.piece.nightmare` | 动画、颜色、发光 |
| 绿叶妻效果 | `.piece.green-wife` | 边框色、背景、发光 |
| 冰冻效果 | `.piece.frozen` | 边框色、背景、动画 |
| 红叶儿效果 | `.piece.red-child` | 样式覆盖 |
| 堆叠指示器 | `.stack-indicator` | 大小、颜色、背景 |
| 骰子界面 | `.dice-interface` | 位置、大小、背景 |
| 骰子方块 | `.d10` | 大小、背景、边框、字体 |
| 右键菜单 | `.context-menu` | 背景、边框、动画 |
| 菜单按钮 | `.ctx-btn` | 颜色、字体、间距 |
| 模态弹窗 | `.modal-overlay`, `.modal-content` | 背景、边框、阴影 |
| 技能结果显示 | `.skill-result-display` | 边框、背景、动画 |
| 状态消息 | `.action-status` | 位置、颜色、动画 |
| 死神骰子 | `.death-god-overlay` | 背景、标题色、骰子样式 |
| 方向骰子 | `.direction-dice-overlay` | 背景、标题色、骰子样式 |
| 概率面板 | `.probability-info-panel` | 位置、大小、背景 |
| 规则按钮 | `.rules-guide-btn` | 位置、大小、背景 |
| 赛博按钮 | `.cyber-btn` | 通用按钮样式 |
| CSS变量 | `:root` | `--bg-color`, `--panel-bg`, `--grid-color`, `--text-primary`, `--text-highlight`, `--accent-color`, `--green-special`, `--grave-color` |
| 故事模式按钮 | `#story-mode` 控制组 | 边框色、标签色 |

每个元素可编辑的通用属性：
- **位置**：margin, padding, top/left/right/bottom（绝对定位元素）
- **大小**：width, height, font-size
- **颜色**：color, background-color, border-color
- **背景**：background-image（上传静态/动态图片）、background-gradient
- **边框**：border-width, border-style, border-radius
- **阴影**：box-shadow, text-shadow
- **透明度**：opacity
- **滤镜**：filter（grayscale, blur, brightness等）
- **动画**：自定义CSS animation
- **字体**：font-family, font-weight, letter-spacing

**2. 交互事件效果编辑器**（所有可触发的浏览器交互事件）：

| 事件ID | 触发条件 | 描述 |
|--------|---------|------|
| `hover_piece_black` | 鼠标悬停黑方棋子 | 悬停黑方棋子时 |
| `hover_piece_white` | 鼠标悬停白方棋子 | 悬停白方棋子时 |
| `hover_piece_neutral` | 鼠标悬停中立棋子 | 悬停中立单位时 |
| `hover_piece_grave` | 鼠标悬停墓碑 | 悬停墓碑时 |
| `hover_piece_ghost` | 鼠标悬停幽灵 | 悬停幽灵时 |
| `hover_cell_empty` | 鼠标悬停空格 | 悬停空棋盘格时 |
| `hover_cell_highlight` | 鼠标悬停高亮移动目标 | 悬停可移动格时 |
| `click_piece_select` | 点击选中棋子 | 点击棋子弹出右键菜单 |
| `click_cell_move` | 点击目标格移动棋子 | 确认棋子移动时 |
| `click_cell_capture` | 点击目标格吃子 | 吃掉敌方棋子时 |
| `context_menu_open` | 右键菜单弹出 | 棋子操作菜单弹出 |
| `skill_activate` | 发动技能 | 主动技能激活时 |
| `skill_success` | 技能成功 | 技能判定成功时 |
| `skill_failure` | 技能失败 | 技能判定失败时 |
| `skill_critical` | 技能大成功（00） | 掷出00终极效果 |
| `dice_roll_start` | 骰子开始滚动 | 骰子动画开始 |
| `dice_roll_end` | 骰子结果显示 | 骰子结果确定 |
| `death_god_move` | 死神移动判定 | 每回合初死神骰子 |
| `death_god_kill` | 死神吃子 | 死神经过并杀死棋子 |
| `death_god_exit` | 死神离场 | 死神走出棋盘消失 |
| `piece_captured` | 棋子被吃 | 任何棋子被吃掉 |
| `piece_to_grave` | 棋子变墓碑 | 被常规吃掉变墓碑 |
| `piece_to_ghost` | 棋子变幽灵 | 被死神吃掉变幽灵 |
| `piece_revive` | 棋子复活 | 医生复活墓碑棋子 |
| `citizen_upgrade` | 市民升变 | 市民到达底线升变 |
| `wife_possess` | 妻子附身 | 妻子附身市民变绿叶妻 |
| `wife_depossess` | 妻子解除附身 | 绿叶妻解散 |
| `child_red_song` | 孩子学红歌 | 孩子成功学唱红歌 |
| `ye_transform` | 叶某变夜魔 | 三条件满足变身 |
| `nightmare_crush` | 夜魔碾压 | 夜魔碾压路径上市民 |
| `police_arrest` | 警察抓捕 | 警察成功拘留 |
| `police_execute` | 警察枪决（00） | 警察掷00就地枪决 |
| `mole_tunnel` | 鼹鼠地道 | 鼹鼠传送棋子 |
| `mole_destroy_grave` | 鼹鼠破坏墓碑 | 鼹鼠破坏墓碑 |
| `monk_save` | 僧侣存档 | 棋子进入修行 |
| `monk_restore` | 僧侣回档 | 修行结束回原位 |
| `dancer_dance` | 大妈共舞 | 广场舞大妈拉人 |
| `piper_fate` | 魔笛手命定 | 魔笛手命定之骰 |
| `officer_summon` | 官员召唤幽灵 | 召唤幽灵成功 |
| `lawyer_swap` | 律师换位 | 律师与官员互换 |
| `turn_change` | 回合切换 | 当前回合切换 |
| `game_start` | 游戏开始 | 先手确定后游戏开始 |
| `game_over_win` | 游戏胜利 | 一方获胜 |
| `game_over_draw` | 游戏平局 | 平局结束 |
| `citizen_v_formation` | 市民V字阵 | V字阵型形成 |
| `citizen_encircle` | 市民包围 | 三人成众包围 |
| `night_phase` | 进入黑夜 | 昼夜判定为黑夜 |
| `day_phase` | 进入白昼 | 昼夜判定为白昼 |
| `stack_picker_open` | 堆叠选择 | 多层堆叠选择弹出 |
| `detention_arrest` | 入拘留区 | 棋子被拘留 |
| `detention_release` | 出拘留区 | 棋子拘留结束释放 |

每个事件可绑定的自定义效果：
- **自定义图片**：静态图片（PNG/JPG/SVG）或动态图片（GIF/APNG/WebP animation）叠加显示
- **自定义音效（SFX）**：触发时播放一次性音效
- **自定义BGM**：触发时切换背景音乐
- **CSS动画效果**：屏幕抖动、闪光、颜色脉冲、粒子效果、光晕等预设效果
- **页面效果**：全屏闪白/闪红、边缘发光、文字弹幕等

**3. 版本管理系统**：
- 自动保存到 `localStorage`（key: `mole_chess_ui_versions`）
- 版本列表带时间戳和描述
- 一键回滚到任意版本
- 导出版本为JSON文件下载
- 导入JSON文件恢复版本
- 每次应用更改前自动创建备份

**4. 样式应用机制**：
- 编辑器将所有CSS修改写入 `ui_editor/custom_theme.css`
- 事件效果配置写入 `localStorage`（key: `mole_chess_effects_config`）
- `effects_engine.js` 在游戏运行时读取配置并执行效果

---

### Effects Engine（事件效果引擎）

#### [NEW] [effects_engine.js](file:///g:/mole_chess_web/ui_editor/effects_engine.js)
运行在游戏主页面中的效果引擎（已在 `index.html` 中通过 `<script>` 引用），负责：
- 从 `localStorage` 读取事件效果配置
- 暴露 `window.MoleChessEffects.triggerEvent(eventId, context)` 全局API
- 在事件触发时播放自定义图片/音效/动画
- `app.js` 中已有部分 `triggerEvent` 调用点，引擎会处理所有注册事件

---

### Custom Theme CSS

#### [NEW] [custom_theme.css](file:///g:/mole_chess_web/ui_editor/custom_theme.css)
由编辑器生成的CSS覆盖文件，初始为空。在 `index.html` 中通过 `<link>` 引用，加载在 `style.css` 之后以确保覆盖优先级。

---

### 主项目文件修改

#### [MODIFY] [index.html](file:///g:/mole_chess_web/index.html)
1. **添加 "故事模式" 按钮**：在控制面板的"机制沙盒模式"之后、"开始游戏"按钮之前，新增风格一致的控制组
2. **删除 UI 编辑器按钮**：移除设置面板中的 `🎨 UI 编辑器` 链接及说明文字（第138-145行）
3. **引用 `custom_theme.css`**：在 `<head>` 中 `style.css` 之后添加 `<link>`
4. 确保 `effects_engine.js` script标签引用正确的路径

---

## Verification Plan

### 浏览器测试（主要验证方式）
由于这是纯前端项目，验证方式以浏览器方式为主：

1. **打开编辑器页面**：直接在浏览器打开 `g:\mole_chess_web\ui_editor\editor.html`，确认页面正常渲染
2. **预览功能验证**：确认编辑器中央的iframe能正确加载游戏主页面
3. **元素编辑验证**：选择一个元素修改其CSS属性，确认预览中实时生效
4. **事件效果验证**：为某个事件添加CSS动画效果，点击"应用"后在游戏页面触发该事件确认效果
5. **版本管理验证**：创建备份→修改→回滚，确认版本切换正常
6. **index.html修改验证**：确认"故事模式"按钮显示且风格与AI模式/观战模式一致
7. **UI编辑器按钮移除验证**：确认index.html中不再显示UI编辑器入口

### 手动验证步骤（请用户协助）
1. 请在浏览器中分别打开 `index.html` 和 `ui_editor/editor.html`
2. 在编辑器中修改一个CSS变量（如主题色），点击应用后刷新游戏页面查看是否生效
3. 确认"故事模式"按钮在游戏页面的侧边栏中正确显示
