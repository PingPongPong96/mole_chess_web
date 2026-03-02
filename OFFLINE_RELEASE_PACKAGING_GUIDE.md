# OFFLINE_RELEASE_PACKAGING_GUIDE.md

## 你现在最关心的结论
1. 你在 Windows 上也可以打包 macOS/Linux 离线包（当前流程是组包，不是本机编译 macOS 程序）。
2. 日常迭代后，优先直接双击根目录 `RELEASE_OFFLINE_WIN.cmd`。
3. 不需要每次都发 prompt 给 Codex；仅在打包失败或需要代处理时再发。

## Windows 手动打包标准流程
1. 先确认以下运行时目录都存在：
- `prebuilt_runtime/win-x64/node/`
- `prebuilt_runtime/macos-arm64/node/`
- `prebuilt_runtime/macos-x64/node/`
- `prebuilt_runtime/linux-x64/node/`

2. 在项目根目录双击：
- `RELEASE_OFFLINE_WIN.cmd`

3. 脚本会自动执行（按当前配置）：
- `npm run test:p0`
- `npm run test:expo-ui`
- `npm run offline:build`
- `npm run offline:verify`
- `node scripts/prepare_outgoing_bundle.mjs`

4. 成功后，取最新交付目录：
- `offline_release/outgoing_release_YYYYMMDD_HHMM/`

5. 对外发送：
- 直接发送该 `outgoing_release_*` 目录（或压缩后发送）

## 关于 RELEASE_OFFLINE_MAC.command / RELEASE_OFFLINE_LINUX.sh
- 这两个脚本是给对应系统本机双击用的。
- 你在 Windows 环境下，通常只需要跑 `RELEASE_OFFLINE_WIN.cmd`。

## 什么时候需要给 Codex 发 prompt 代打包
当出现以下情况时建议发：
1. 一键脚本报错，你需要我定位并修复。
2. 你希望“自动修复 + 重打包 + 验包 + 输出可交付目录”一次完成。
3. 你只想让我代执行命令并回传结果摘要。

## 可直接复制的 Prompt 模板

### 模板 A：允许修复并重打包
```text
请帮我在当前仓库执行一次完整离线发布：
1) npm run release:expo
2) 如果失败，定位并修复后重跑，直到通过
3) 最后告诉我最新 outgoing_release 目录名，以及应发送给对方的文件路径
本次允许你改代码并重新打包。
```

### 模板 B：只执行打包，不改代码
```text
请只执行打包与验包，不修改任何代码：
npm run release:expo
并返回最新 outgoing_release 目录路径与结果摘要。
```

## 常见误区
1. 误区：Windows 不能产出 macOS 包。
- 纠正：本项目当前离线包是“预置运行时 + 文件组包”，Windows 可统一产出三平台包。

2. 误区：每次迭代都必须让 Codex 代打包。
- 纠正：可以完全本地自行一键发布；Codex 主要用于失败时排障和修复。
