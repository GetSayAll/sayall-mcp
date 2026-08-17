# v1 兼容政策

## 起点

未发布的 Node.js 实现、CLI、旧 Application Support 路径和旧事件格式不属于兼容范围。首个正式发布的无线麦SayAll.app MCP 契约定义为 `v1`，从该版本开始承担向后兼容责任。

## 保持稳定

未来新版无线麦SayAll.app 必须继续支持：

- App 安装路径稳定时，旧 Agent 配置中的 `Contents/Helpers/SayAllMCP`；
- `serve` 启动参数；
- `SAYALL_MCP_CLIENT_ID` 和 `SAYALL_MCP_ACCESS_TOKEN`；
- `list_transcript_apps` 和 `query_transcripts` 工具名；
- 已发布输入字段的含义、默认值、边界和游标语义；
- 已发布输出结构、字段名称、类型和含义；
- `RemoteMic/MCP/v1/access.json` 与 `RemoteMic/Transcripts/v1` 数据。

## 允许的演进

- 增加新的可选输入字段；
- 增加新工具；
- 修正不影响已发布合法请求的安全或实现缺陷；
- 在保持旧协议版本可协商的前提下支持新的 MCP 协议版本。

## 破坏性变化

`v1` 输出对象使用 `additionalProperties: false`，因此新增或删除输出字段、改变已发布语义、使用不兼容授权格式或改变分页行为时，必须使用新工具名或并行 `v2`。新版可以读取旧 `v1`，但旧版不需要理解未来 `v2`；不同版本目录不得覆盖彼此。

## 发布门禁

首个正式 `v1` 应保存脱敏配置、Schema、合法请求/响应 Fixture 和版本化本地状态基线。后续发布前必须用这些基线验证旧配置、旧授权、旧请求和必需输出字段继续工作。
