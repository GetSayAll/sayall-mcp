# SayAll MCP

无线麦SayAll.app 本地语音转文字历史的公开 MCP 接口契约与集成资料。

本仓库不提供、安装或运行 MCP 服务。唯一正式运行时是随无线麦SayAll.app 安装的原生 Swift Helper：

```text
/Applications/SayAll.app/Contents/Helpers/SayAllMCP
```

用户只需安装无线麦SayAll.app，不需要克隆本仓库，也不需要 Node.js、npm、Homebrew、Xcode 或其他编程环境。

## 如何使用

1. 在无线麦SayAll.app 的“回眸”页面开启“本地 Agent 访问”。
2. 为 Codex、Claude Desktop、Cursor 或其他 MCP Host 创建独立只读授权。
3. 从 App 复制 Codex TOML 或标准 `mcpServers` JSON，粘贴到对应客户端并重启客户端。
4. Agent Host 按需启动 App 包内 Helper；无线麦SayAll.app 主进程不必常驻。

完整步骤见 [快速开始](docs/getting-started.md)。仓库内的 [配置示例](examples/) 只包含占位符；真实 client ID 和访问令牌只能由用户在 App 内生成。

## 当前能力

- `list_transcript_apps`：列出历史中出现的 App、记录数和时间范围，不返回正文；
- `query_transcripts`：按时间和 Bundle ID 查询历史，支持升序、倒序和稳定分页；
- 本机总开关默认关闭；
- 每个 Agent 客户端拥有独立的 256-bit 访问令牌，可单独撤销；
- 访问审计不记录转写正文、令牌或完整 MCP 响应；
- 接口只有读取能力，不提供新增、修改、删除或清空历史的工具；
- Helper 只使用 MCP `stdio`，不监听 HTTP/TCP，不注册 Bonjour，不常驻。

工具的输入、输出与隐私字段边界见 [工具参考](docs/tool-reference.md) 和 [JSON Schema](schemas/)。

## 仓库定位

其他 AI、Agent 或 App 集成方无需阅读无线麦SayAll.app 主仓库，只需使用本仓库中的：

- 接口和字段说明；
- JSON Schema；
- 标准 JSON 与 Codex 配置示例；
- 授权、隐私和错误处理说明；
- `v1` 向后兼容政策；
- 测试手册与无敏感数据 Fixture。

Swift 运行时、App 图形授权管理、签名和打包由无线麦SayAll.app 主仓库维护。这里不复制第二套实现，避免契约与实际运行时分叉。

## 隐私边界

无线麦SayAll.app 与 Helper 不主动上传语音历史。但被授权的 Codex、Claude Desktop 或其他客户端如果使用云端模型，可能把 MCP 返回的文字发送给自己的服务商。创建授权前，应确认对应客户端的数据处理方式。

当前授权边界面向正常本机集成，不宣称能够抵御运行在同一 macOS 登录用户下的恶意非沙盒进程；这类进程理论上也可能绕过 MCP，直接尝试读取用户自己的 Application Support 文件。详见 [隐私说明](docs/privacy.md) 与 [安全说明](SECURITY.md)。

## 兼容政策

未发布的 Node 实现、旧 Application Support 路径和旧格式不属于兼容范围。canonical Helper 为 `/Applications/SayAll.app/Contents/Helpers/SayAllMCP`；从其他目录运行时，App 生成当前真实路径。首个正式发布的接口是 `v1`；从 `v1` 开始，未来版本保持安装路径未变化时的旧 Agent 配置、旧工具参数、已发布返回结构和 `v1` 本地数据可继续使用。`v1` 输出是封闭 Schema，新增输出字段或其他破坏性变化将使用新工具名或并行 `v2`。

完整规则见 [兼容政策](docs/compatibility.md)。

## 资料索引

- [快速开始](docs/getting-started.md)
- [授权模型](docs/authorization.md)
- [工具参考](docs/tool-reference.md)
- [隐私说明](docs/privacy.md)
- [兼容政策](docs/compatibility.md)
- [测试手册](Testing/RemoteMicLocalHistoryMCP.md)
- [功能档案](feature/remote-mic-local-history/README.md)
- [变更记录](CHANGELOG.md)

## 许可证

[MIT](LICENSE)。允许其他 App 和 Agent 使用这些契约与资料完成集成，但仍需自行遵守用户授权、隐私告知和第三方模型服务的数据处理要求。
