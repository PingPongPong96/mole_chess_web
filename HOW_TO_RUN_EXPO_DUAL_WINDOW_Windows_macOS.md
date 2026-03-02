# HOW TO RUN EXPO DUAL WINDOW (Windows/macOS)

本指引用于线下展出模式：同一台电脑打开两个游戏窗口，共享同一局（`expo=1`）。

## 30 秒快速启动

1. 打开终端，进入项目根目录。
2. 运行：

```bash
npm run expo:run:two
```

3. 脚本会自动：
- 启动本地 HTTP 服务（避免 `file://`）
- 打开第一个窗口
- 延迟再打开第二个窗口

默认地址形如：

```text
http://127.0.0.1:8787/index.html?expo=1
```

如果 8787 被占用，会自动尝试 8788、8789……

根目录也提供了“一键点击即玩”脚本：

- Windows: `PLAY_NOW_WIN.cmd`
- macOS: `PLAY_NOW_MAC.command`
- Linux: `PLAY_NOW_LINUX.sh`

## 维护后“一键重打包发布”（无需再发 prompt）

根目录一键发布脚本：

- Windows: `RELEASE_OFFLINE_WIN.cmd`
- macOS: `RELEASE_OFFLINE_MAC.command`
- Linux: `RELEASE_OFFLINE_LINUX.sh`

它会自动串行执行：

1. `npm run test:p0`
2. `npm run test:expo-ui`
3. `npm run offline:build`
4. `npm run offline:verify`
5. `node scripts/prepare_outgoing_bundle.mjs`

失败会提示查看日志目录：`offline_release/release_logs/`。

## 可用命令

```bash
npm run expo:run
npm run expo:run:once
npm run expo:run:two
npm run expo:stop:hint
npm run release:expo
```

## 参数（高级）

直接运行 Node 脚本时可传参：

```bash
node expo_dual_window_launcher.mjs --open=2 --port=8787 --page=index.html --query=expo=1 --delay=900
```

参数说明：
- `--open`：打开窗口数量（默认 2）
- `--port`：起始端口（默认 8787）
- `--page`：页面路径（默认 `index.html`）
- `--query`：查询参数（默认 `expo=1`）
- `--delay`：第二窗口延迟毫秒（默认 900）

离线打包后的 `launch/PLAY_NOW_*` 会默认使用 `expo=1&fresh=1`，保证展出机每次启动时重置可能污染界面的本地 UI 样式缓存。

## 单屏测试（你当前环境）

1. 保持两个窗口并排。
2. 在 A 窗口开始游戏并操作一步。
3. 观察 B 窗口是否同步（棋盘、回合、日志一致）。
4. 反向在 B 操作，再看 A 是否同步。

## 双屏现场操作

1. 两个窗口分别拖到左右显示器。
2. 如使用双鼠标，多指针由系统/工具层提供（项目本身不区分鼠标设备 ID）。

## 常见问题

1. 不是同一局：
- 检查是否误用 `file://`。
- 必须用 `http://127.0.0.1:<port>/...`。

2. 第二次没有新“窗口”而是新标签页：
- 这是浏览器策略行为。
- 手动新建一个浏览器窗口（`Ctrl+N` 或 `Cmd+N`），访问同一 URL 即可。

3. 端口冲突：
- 脚本会自动换下一个端口。
- 以控制台打印的最终 URL 为准。

## 退出

在运行脚本的终端按 `Ctrl + C`，服务会优雅停止。

## 三平台离线打包（点击即玩）

已提供离线打包与验包脚本：

```bash
npm run offline:build
npm run offline:verify
npm run offline:build:win
npm run offline:build:mac
npm run offline:build:mac:x64
npm run offline:build:linux
```

构建前需先放入便携 Node 运行时：

- `prebuilt_runtime/win-x64/node/`
- `prebuilt_runtime/macos-arm64/node/`
- `prebuilt_runtime/macos-x64/node/`
- `prebuilt_runtime/linux-x64/node/`

构建产物目录：

- `offline_release/mole_chess_offline_win-x64/`
- `offline_release/mole_chess_offline_macos-arm64/`
- `offline_release/mole_chess_offline_macos-x64/`
- `offline_release/mole_chess_offline_linux-x64/`

每个离线包内都带一键启动脚本：

- `launch/PLAY_NOW_WIN.cmd`
- `launch/PLAY_NOW_MAC.command`
- `launch/PLAY_NOW_LINUX.sh`

## 对外发送哪个包

每次发布后发送这个目录（或压缩后发送）：

- `offline_release/outgoing_release_YYYYMMDD_HHMM/`

目录内固定包含：

1. `mole_chess_offline_win-x64/`
2. `mole_chess_offline_macos-arm64/`
3. `mole_chess_offline_macos-x64/`
4. `mole_chess_offline_linux-x64/`
5. `DELIVERY_README.md`
6. `DELIVERY_CONTENTS.txt`
7. `DELIVERY_SHA256.txt`
