# TODO

- [ ] 发布无线麦SayAll.app 本地语音历史 MCP `v1`
  - 公开契约、JSON Schema、配置示例、授权与隐私说明、兼容政策和测试手册已经建立。
  - 唯一正式运行时由无线麦SayAll.app 内的 Swift Helper 提供；本仓库不再包含 Node.js 运行时、CLI 或安装脚本。
  - App 图形界面已实现默认关闭总开关、每客户端授权、撤销和配置复制。
  - canonical Helper 路径已更新为 `/Applications/SayAll.app/Contents/Helpers/SayAllMCP`；非标准目录使用 App 生成的真实路径，移动或旧路径授权通过私有路径指纹提示重新连接，不覆盖其他 MCP。
  - 仍需使用正式候选 App 在 Codex 和至少一个标准 JSON MCP 客户端完成真实配置、分页读取、撤销、关闭后拒绝和升级兼容人工验收；完成前不标记为已完成。
