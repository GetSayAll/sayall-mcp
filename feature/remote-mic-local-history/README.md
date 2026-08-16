# Remote Mic 本地语音历史 MCP

## 为什么开发

Remote Mic 已经在用户主动开启后把语音转文字历史保存在本机，但其他 Agent 没有一个明确、可授权、可撤销的读取入口。本功能通过本机 MCP stdio 提供只读访问，让 Agent 能够自行分析今天、本周或不同 App 的历史，而不把分析逻辑放进 Remote Mic。

## 用户功能

- 本地总开关默认关闭；
- 用户通过 CLI 为每个客户端创建独立只读授权；
- Agent 可以列出 App，并按时间和 App 分页读取记录；
- 用户可以撤销单个客户端或关闭全部访问；
- Remote Mic 和 SayAll MCP 不主动上传历史。

## 范围与非目标

本次只实现读取。不会修改、删除、恢复、总结、聚类、搜索、Embedding、订阅或上传语音历史。不会复用 Remote Mic 的手机服务、Web Relay 或其他网络协议。

## 关键设计

- 使用官方 MCP SDK 的 stdio transport；
- Helper 按 Agent 会话启动，不创建常驻服务；
- 256-bit 随机令牌只保存 SHA-256 哈希；
- 开关、授权、撤销和审计采用追加事件日志；
- 每次工具调用重新校验开关、令牌和撤销状态；
- 查询强制分页，默认 100、最大 500；
- App 列表和审计不包含转写正文；
- 读取 Swift `JSONEncoder` 默认 Apple 参考日期并转换为 ISO-8601。

## 涉及文件

- `src/remote-mic/history-store.ts`：磁盘 Schema、App 汇总、过滤和分页；
- `src/remote-mic/authorization-store.ts`：开关、授权、哈希验证和撤销；
- `src/remote-mic/audit-log.ts`：脱敏访问审计；
- `src/remote-mic/server.ts`：两个只读 MCP 工具；
- `src/cli.ts`：本机授权和服务启动命令；
- `tests/`：核心与 MCP 集成自动化；
- `Testing/RemoteMicLocalHistoryMCP.md`：人工测试手册。

## 隐私与兼容边界

服务只读取 `Application Support/RemoteMic/Transcripts/v1`，不会更改现有格式。Remote Mic 和 SayAll MCP 不上传数据，但被授权客户端可能把读取内容发送给其云端模型。同一 macOS 登录用户下的恶意非沙盒进程不属于首版可强隔离边界。

## 自动化验证

- 3 个测试文件、10 项测试通过；
- TypeScript 严格类型检查通过；
- 生产构建通过；
- MCP 集成测试确认只暴露两个工具，撤销后已有连接的下一次查询被拒绝；
- 审计测试确认不包含正文和令牌。
- 历史根目录和私有事件文件明确拒绝符号链接，避免读取或追加到非预期位置。
- 构建后的解析器已只读加载本机真实 Remote Mic 历史，正确识别 Codex/TextEdit 分组和 Apple 参考日期，`skippedFileCount` 为 0；该验证没有输出正文或修改文件。

## 人工测试

见 [`Testing/RemoteMicLocalHistoryMCP.md`](../../Testing/RemoteMicLocalHistoryMCP.md)。

## 当前状态与限制

当前状态：候选实现完成，等待真实 Codex MCP 配置和用户数据流验收。

已知限制：首版授权使用 CLI，没有 Remote Mic 图形界面；仓库路径移动后需要更新 MCP 配置中的 Helper 路径；接口本地不等于第三方 AI 客户端一定离线。
