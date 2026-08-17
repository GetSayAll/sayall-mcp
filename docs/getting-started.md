# 快速开始

## 前提

- 已安装包含 MCP Helper 的无线麦SayAll.app；
- 已在“回眸”中开启“记录回眸”，并存在可供测试的无隐私记录；
- 使用支持本机 MCP `stdio` 的 Agent Host，例如 Codex、Claude Desktop、Cursor 或 Windsurf。

原始 LLM HTTP API 本身不能启动本机 `stdio` 进程，需要由支持 MCP 的桌面 App 或 Agent Host 承载。

## 接入步骤

1. 打开无线麦SayAll.app“回眸”页面。
2. 在“本地 Agent 访问”中主动开启总开关。
3. 输入当前客户端名称并创建只读授权。
4. 按客户端类型复制 Codex TOML 或标准 MCP JSON。
5. 粘贴到客户端配置并重启客户端。
6. 调用 `list_transcript_apps`，确认 App 汇总不包含正文。
7. 调用 `query_transcripts`，使用短时间范围和较小 `limit` 验证读取。

无线麦SayAll.app 主进程不必保持运行。Agent Host 会按需启动安装包内的 Swift Helper，客户端退出后 Helper 随之结束。

## 配置结构

标准 JSON 见 [`examples/standard-mcp.json`](../examples/standard-mcp.json)，Codex TOML 见 [`examples/codex.toml`](../examples/codex.toml)。示例中的 client ID 和令牌是占位符，不能直接使用。

配置的稳定入口为：

```text
command: /Applications/Remote Mic.app/Contents/Helpers/SayAllMCP
args: ["serve"]
env: SAYALL_MCP_CLIENT_ID, SAYALL_MCP_ACCESS_TOKEN
```

如果用户把 App 移到其他路径，需要从 App 重新复制配置。不要手工猜测或共享访问令牌。
