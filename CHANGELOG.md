# Changelog

本文件记录已发布的 MCP 契约变化。未发布内容可以调整；首个正式版本发布后遵守 [`docs/compatibility.md`](docs/compatibility.md)。

## Unreleased

- 将仓库定位为无线麦SayAll.app MCP 的公开契约与集成资料入口。
- 移除未发布的 Node.js 运行时、CLI、安装脚本和源码构建流程。
- 确立 App 包内原生 Swift Helper 为唯一正式运行时。
- 定义 `v1` 的两个只读工具、JSON Schema、配置示例、授权和向后兼容政策。
- 将 canonical Helper 更新为 `/Applications/SayAll.app/Contents/Helpers/SayAllMCP`，并记录非标准路径及 App 移动后的安全重新连接边界。
