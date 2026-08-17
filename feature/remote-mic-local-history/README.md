# 无线麦SayAll.app 本地语音历史 MCP

## 为什么开发

无线麦SayAll.app 已经在用户主动开启后把语音转文字历史保存在本机，但其他 Agent 需要一个明确、可授权、可撤销且无需阅读 App 主仓库的读取契约。本仓库作为公开集成入口，描述 App 内 Swift Helper 提供的本机 MCP `stdio` 能力。

## 用户功能

- 本地总开关默认关闭；
- 用户在无线麦SayAll.app“回眸”页面为每个客户端创建独立只读授权；
- App 直接生成标准 `mcpServers` JSON 和 Codex TOML；
- Agent 可以列出 App，并按时间和 App 分页读取记录；
- 用户可以撤销单个客户端或关闭全部访问；
- 用户只安装无线麦SayAll.app，不需要编程工具或依赖环境。

## 范围与非目标

本次只定义读取接口。不会修改、删除、恢复、总结、聚类、搜索、Embedding、订阅或上传语音历史，不复用无线麦SayAll.app 的手机服务、Web Relay 或其他网络协议。本仓库不提供第二套运行时，也不提供动态插件系统。

## 关键设计

- 唯一运行时为 App 包内 `Contents/Helpers/SayAllMCP` 原生 Swift 可执行文件；
- Helper 按 Agent 会话通过 `serve` 启动，不创建常驻服务；
- 256-bit 随机令牌只保存 SHA-256 哈希；
- 每次工具调用重新校验开关、令牌和撤销状态；
- 查询强制分页，默认 100、最大 500；
- App 列表和审计不包含转写正文；
- `GetSayAll/sayall-mcp` 只保存契约、Schema、示例和测试资料，方便第三方独立集成。

## 涉及文件

- `README.md`：仓库定位和集成入口；
- `docs/`：快速开始、授权、隐私、工具和兼容政策；
- `schemas/`：两个工具的 `v1` 输入和输出 JSON Schema；
- `examples/`：不含真实凭据的客户端配置；
- `fixtures/`：不含真实用户数据的示例响应；
- `Testing/RemoteMicLocalHistoryMCP.md`：人工测试手册。

## 隐私与兼容边界

服务只读取 `Application Support/RemoteMic/Transcripts/v1`。无线麦SayAll.app 和 Helper 不主动上传数据，但被授权客户端可能把读取内容发送给其云端模型。同一 macOS 登录用户下的恶意非沙盒进程不属于首版可强隔离边界。

未发布的 Node 实现不纳入兼容。正式 `v1` 发布后，旧 Agent 配置、工具参数、封闭输出结构和 `v1` 本地数据必须继续可用；可增加可选输入或新工具，新增输出字段及其他破坏性变化使用新工具名或并行 `v2`。

## 自动化验证

- JSON Schema 和配置 JSON 可由标准 JSON 解析器校验；
- Schema 与无线麦SayAll.app Swift Helper 的 `tools/list` 定义逐字段比对；
- Fixture 覆盖 App 汇总和分页记录的公开字段；
- 人工兼容测试保存首个正式 `v1` 的配置、授权状态和请求/响应基线，并用于后续 App 升级回归。

## 人工测试

见 [`Testing/RemoteMicLocalHistoryMCP.md`](../../Testing/RemoteMicLocalHistoryMCP.md)。

## 当前状态与限制

当前状态：候选契约完成，等待标准 JSON 客户端和 Codex 的真实数据流验收。

已知限制：本地 MCP 不等于第三方 AI 客户端离线；用户移动 App 导致 Helper 绝对路径变化时，需要从无线麦SayAll.app 重新复制配置。
