# TODO

- [ ] 无线麦SayAll.app 本地语音历史只读 MCP
  - MCP stdio 服务、App 列表、按时间/App 查询、稳定分页、默认关闭、每客户端授权、撤销和脱敏审计已经实现并通过自动化测试。
  - 已提供一行 Git clone + 无参数 `./setup.sh` 接入；自动安装、构建、开启、授权并生成标准 `mcpServers` JSON 和 Codex TOML。
  - 已补充简短顶层 CLI、旧命令兼容、MCP 输出 Schema、MIT 许可和公开包元数据。
  - 仍需用户在至少一个标准 JSON 客户端和 Codex 中完成授权、分页读取、撤销和关闭后拒绝的人工验收；完成前不标记为已完成。
- [ ] 无线麦SayAll.app 图形界面授权管理
  - 当前首版通过 `sayall-mcp` CLI 管理总开关和客户端令牌；未来如需在无线麦SayAll.app“语音记录”页面管理授权，可复用现有追加事件格式。
