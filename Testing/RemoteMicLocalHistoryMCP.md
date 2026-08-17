# 无线麦SayAll.app 本地语音历史 MCP 测试手册

## 适用范围

- 仓库：`GetSayAll/sayall-mcp`
- 分支：`main`
- 版本：`0.1.0`
- 平台：macOS
- 当前状态：候选实现，等待真实多客户端 MCP 验收

## 测试前准备

1. 安装 Node.js 20 或以上版本；执行 `git clone --depth 1 https://github.com/GetSayAll/sayall-mcp.git && ./sayall-mcp/setup.sh`，或在已有仓库根目录执行 `./setup.sh`。
2. 安装已经支持本地语音记录的无线麦SayAll.app，并在“语音记录”页开启保存功能。
3. 在 TextEdit 和 Codex 中分别产生至少两条语音记录，确认无线麦SayAll.app 页面中能够看到。
4. 准备一个使用标准 `mcpServers` JSON 的客户端和 Codex；原始 LLM API 不属于可直接连接 stdio MCP 的客户端。
5. 不要把 `authorize` 输出的令牌粘贴到聊天、Issue、截图或版本库。
6. 记录测试时间、客户端名称、授权 client ID 和失败命令；问题日志中不得包含令牌或转写正文。

## 用例 1：默认关闭

1. 在没有执行 `node dist/cli.js enable` 的新环境中执行 `node dist/cli.js authorize --name TestAgent`。
2. 尝试以任意 client ID 和令牌启动 `node dist/cli.js serve`。

预期结果：创建授权和启动服务都被拒绝，错误明确表示本地 Agent 访问未开启；不会返回任何 App 或正文。

失败判定：默认状态可以读取历史，或错误信息泄漏文件路径、令牌、历史正文。

## 用例 2：开启并创建客户端授权

1. 执行 `./setup.sh "Standard-JSON-Test"`。
2. 确认脚本自动安装、构建并输出标准 `mcpServers` JSON 和 Codex TOML。
3. 把标准 JSON 保存到兼容客户端，把 Codex TOML 保存到 Codex；都不写入仓库。
4. 执行 `node dist/cli.js status` 和 `node dist/cli.js list`。

预期结果：一条 setup 命令完成开启和授权；两种配置都使用简短 `serve` 参数；总开关为开启；授权列表包含 Standard-JSON-Test、client ID、范围和创建时间，但不显示令牌哈希或明文令牌。

失败判定：令牌被持久化为明文、授权文件权限不是 `0600`，或不同客户端共用同一个 client ID。

## 用例 3：列出 App

1. 分别在标准 JSON 客户端和 Codex 中连接 MCP。
2. 调用 `list_transcript_apps`。

预期结果：返回无线麦SayAll.app 历史中的 App 名称、Bundle ID、记录数和最早/最新时间；不返回任何转写正文。

失败判定：缺少已经存在的 App、返回正文、内部文件路径、session ID 或 `applicationKey`。

## 用例 4：今天、本周和单个 App 查询

1. 调用 `query_transcripts`，传入今天的 ISO-8601 时间范围。
2. 改为最近七天时间范围。
3. 增加一个真实 Bundle ID 筛选。
4. 分别使用升序和倒序。

预期结果：只返回范围内记录；App 筛选准确；时间顺序稳定；每条只包含公开字段和本次转写文字。

失败判定：跨范围返回、跨 App 串记录、日期时区错误、包含已删除记录或内部字段。

## 用例 5：全部历史分页

1. 使用 `limit: 1` 调用 `query_transcripts`。
2. 使用返回的 `nextCursor` 连续读取，直到 `hasMore` 为 false。
3. 记录所有 ID，检查是否重复或遗漏。
4. 把倒序 cursor 用在升序查询中。

预期结果：分页不重不漏；最后一页 `nextCursor` 为 null；顺序不匹配的 cursor 被拒绝。

失败判定：一次无视 limit 返回全部历史、游标可以跨顺序混用、重复、遗漏或无限循环。

## 用例 6：错误令牌与撤销

1. 把配置中的令牌改错一个字符后连接。
2. 恢复正确配置，确认可以读取。
3. 执行 `node dist/cli.js revoke --client-id <UUID>`。
4. 不重启 Agent 客户端，再次调用两个工具。

预期结果：错误令牌拒绝；正确令牌可用；撤销后的下一次调用立即拒绝，即使 MCP 进程此前已经连接。

失败判定：错误令牌可读、撤销只在重启后生效，或撤销一个客户端影响其他有效授权。

## 用例 7：关闭后拒绝与历史保留

1. 新建一个有效客户端并成功读取。
2. 执行 `node dist/cli.js disable`。
3. 再次调用 MCP。
4. 打开无线麦SayAll.app“语音记录”页面。

预期结果：所有客户端立即被拒绝；无线麦SayAll.app 中已有历史保持不变；重新开启后未撤销的令牌恢复可用。

失败判定：关闭删除历史、关闭后仍能读取，或必须重新生成全部授权。

## 用例 8：损坏文件与并发删除

1. 只在测试副本中准备一个损坏日期 JSON，不修改真实用户历史。
2. 同时保留一个合法日期文件。
3. 查询时在无线麦SayAll.app 页面删除另一条测试记录。

预期结果：损坏文件计入 `skippedFileCount`，合法记录仍可读；并发删除不会崩溃、恢复或改写历史。

失败判定：整个查询失败、返回损坏内容、恢复已删除记录或修改无线麦SayAll.app 文件。

## 用例 9：本地与网络边界

1. MCP 连接期间检查 Helper 进程。
2. 检查是否存在由 Helper 创建的 TCP/UDP 监听端口或 Bonjour 服务。
3. 退出 Agent 客户端。

预期结果：Helper 只通过 stdin/stdout 通信；没有网络监听；客户端退出后 Helper 结束。

失败判定：出现 localhost 或局域网监听、访问无线麦SayAll.app Web Relay、退出后仍常驻。

## 稳定功能回归

- 无线麦SayAll.app 继续按 App 和日期保存、显示、复制和可恢复删除历史；
- MCP 开关缺失、关闭、开启、使用后关闭四种状态不影响语音捕获；
- MCP 查询不修改 JSON、文件权限、日期分组或 App 图标；
- 无历史目录时返回空集合，不创建伪造历史；
- CLI stdout 在 serve 模式只输出 MCP 协议，诊断只写 stderr。

## 日志收集

- 本地脱敏审计：`~/Library/Application Support/SayAllMCP/RemoteMicHistory/v1/audit/`；
- 开关事件：同目录 `settings.ndjson`；
- 授权事件：同目录 `authorizations.ndjson`；
- 不要提交这些文件，也不要复制其中的 client ID 到公开问题；
- 不收集或转发 MCP 客户端配置中的明文令牌。

## 自动化、代理实测和用户实测边界

自动化覆盖历史解析、Apple 日期转换、App 汇总、过滤、分页、畸形 cursor、损坏文件、符号链接拒绝、默认关闭、令牌哈希、文件权限、错误令牌、撤销、关闭、标准 JSON/Codex 配置生成、只读 Tool Annotations、输出 Schema 和 MCP 工具级撤销复查。类型检查和构建只证明源码边界。

代理已使用构建后的只读解析器加载本机真实无线麦SayAll.app 历史，确认实际 JSON Schema、Codex/TextEdit 分组和 Apple 日期转换兼容，过程中没有输出正文。当前尚未把真实用户令牌写入标准 JSON 客户端或 Codex 配置，也未使用真实历史正文执行云端 Agent 调用，因此不能表述为已经完成真实多客户端数据流验收。用户需要确认其选定 AI 客户端是否会把 MCP 返回内容上传给第三方服务商。
