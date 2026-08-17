# SayAll MCP

SayAll 产品的本机 MCP 服务集合。当前提供无线麦SayAll.app 语音转文字历史的只读接口，供支持 MCP `stdio` 的 AI App、Agent 和自动化工具使用。

仓库公开供其他 App 集成。服务使用 MCP `stdio`，不监听 HTTP/TCP 端口，不注册 Bonjour，也不把无线麦SayAll.app 历史上传到 SayAll 服务。

原始 LLM API 本身不能直接启动本机 MCP 进程，需要由 Codex、Claude Desktop、Cursor、Windsurf 或其他支持 MCP `stdio` 的 Agent/Host 承载。

## 最简接入

要求 macOS 和 Node.js 20 或以上版本。首次使用只需一行：

```bash
git clone --depth 1 https://github.com/GetSayAll/sayall-mcp.git && ./sayall-mcp/setup.sh
```

脚本会自动安装依赖、构建、开启本地只读访问、创建独立授权，并输出两段可直接复制的配置：

- 标准 `mcpServers` JSON：适用于 Claude Desktop、Cursor、Windsurf 和其他兼容客户端；
- Codex TOML：适用于 Codex。

需要区分多个客户端时，为每个客户端分别运行一次并提供名称：

```bash
./sayall-mcp/setup.sh "Claude Desktop"
./sayall-mcp/setup.sh "Cursor"
```

每次运行都会创建独立授权，之后可以单独撤销。配置中包含一次性显示的明文访问令牌，不要提交到 Git、粘贴到 Issue、聊天记录或日志中。复制配置并重启对应客户端后即可使用。

## 当前能力

- `list_transcript_apps`：列出历史中出现的 App、记录数和时间范围，不返回正文；
- `query_transcripts`：按时间和 Bundle ID 查询历史，支持升序、倒序和稳定分页；
- 本机总开关，默认关闭；
- 每个 Agent 客户端拥有独立的 256-bit 访问令牌；
- 可以单独撤销授权或关闭全部访问；
- 访问审计不记录转写正文、令牌或完整 MCP 响应；
- 接口只有读取能力，不提供新增、修改、删除或清空历史的工具。

## 隐私边界

无线麦SayAll.app 和 SayAll MCP 不主动上传语音历史。但如果被授权的 Codex、Claude Desktop 或其他客户端使用云端模型，它可能把 MCP 返回的文字发送给自己的服务商。创建授权前应确认该客户端的数据处理方式。

当前授权边界面向正常本机集成，不宣称能够抵御运行在同一 macOS 登录用户下的恶意非沙盒进程；这类进程理论上也可能绕过 MCP，直接尝试读取用户自己的 Application Support 文件。

## 数据来源

只读以下现有目录，不修改文件：

```text
~/Library/Application Support/RemoteMic/Transcripts/v1/
```

本机授权和脱敏审计保存在：

```text
~/Library/Application Support/SayAllMCP/RemoteMicHistory/v1/
```

目录权限为 `0700`，事件文件权限为 `0600`。开关、授权、撤销和审计均采用追加事件日志，不通过覆盖或删除旧文件更新状态。

## 开发

要求 Node.js 20 或以上版本。

```bash
npm install
npm run typecheck
npm test
npm run build
```

## 高级管理

以下命令从仓库目录运行。正式发布 npm 包后也可以直接使用 `sayall-mcp` 命令；当前源码安装使用 `node dist/cli.js`。

查看状态和授权列表：

```bash
node dist/cli.js status
node dist/cli.js list
```

撤销单个客户端：

```bash
node dist/cli.js revoke --client-id <UUID>
```

关闭或重新开启全部访问：

```bash
node dist/cli.js disable
node dist/cli.js enable
```

为自动化脚本输出机器可读 JSON：

```bash
node dist/cli.js setup --name "My Agent" --json
```

关闭总开关不会删除无线麦SayAll.app 历史或授权事件，但所有 MCP 查询会立即被拒绝。

旧版 `node dist/cli.js remote-mic <command>` 语法继续兼容，已有客户端配置不需要立即修改。

## MCP 配置

生成的配置包含：

- 当前 Node.js 可执行文件；
- 构建后的 `dist/cli.js` 绝对路径；
- `serve` 参数；
- `SAYALL_MCP_CLIENT_ID`；
- `SAYALL_MCP_ACCESS_TOKEN`。

默认 `setup` 输出可读的标准 JSON 和 Codex TOML；加 `--json` 后返回 `mcpConfig`、`standardJson` 和 `codexToml`，方便安装器或其他 App 自动集成。

Agent 客户端通过该配置按需启动 Helper。Helper 只在 stdio 上运行，客户端退出后进程随之结束。仓库路径移动或重新安装后，需要重新复制配置中的脚本路径，但不必重新生成授权。

## 查询参数

`query_transcripts` 支持：

- `startedAtOrAfter`：ISO-8601，包含边界；
- `endedAtBefore`：ISO-8601，不包含边界；
- `bundleIdentifiers`：最多 100 个 Bundle ID；
- `order`：`ascending` 或 `descending`；
- `limit`：默认 100，范围 1–500；
- `cursor`：上一页返回的不透明游标。

返回内容只包括记录 ID、开始/结束时间、本地日期、时区、App 名称、Bundle ID、输入来源和本次转写文字，不返回内部会话 ID、磁盘路径、`applicationKey` 或捕获诊断字段。

## 验证资料

- [测试手册](Testing/RemoteMicLocalHistoryMCP.md)
- [功能档案](feature/remote-mic-local-history/README.md)

## 许可证

[MIT](LICENSE)。允许其他 App 和 Agent 集成、修改和分发，但仍需自行遵守用户授权、隐私告知和第三方模型服务的数据处理要求。
