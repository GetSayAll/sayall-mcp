# 无线麦SayAll.app 本地语音历史 MCP 测试手册

## 适用范围

- 仓库：`GetSayAll/sayall-mcp`
- 契约：首个正式发布候选 `v1`
- 平台：macOS 14 及以上
- 运行时：无线麦SayAll.app 包内 Swift `SayAllMCP` Helper
- 当前状态：候选契约，等待真实多客户端 MCP 验收

## 测试前准备

1. 安装包含 `Contents/Helpers/SayAllMCP` 的完整无线麦SayAll.app；不要从本仓库安装运行时。
2. 不安装 Node.js、npm、Homebrew 或 Xcode，确认普通用户依赖边界。
3. 在“回眸”页开启“记录回眸”，并在两个 App 中分别产生两天以上的无隐私测试记录。
4. 准备 Codex 和至少一个使用标准 `mcpServers` JSON 的客户端；原始 LLM API 不属于可直接连接 stdio MCP 的客户端。
5. 在 App 内开启“本地 Agent 访问”，分别为两个客户端创建独立授权并复制配置。
6. 不要把令牌、真实 client ID 或转写正文粘贴到聊天、Issue、截图、日志或版本库。

## 用例 1：配置与零依赖安装

1. 对比 App 生成的配置与 `examples/codex.toml`、`examples/standard-mcp.json` 的结构。
2. 确认 command 指向安装 App 内 Helper，args 只有 `serve`，env 只有两个凭据字段。
3. 在没有编程依赖的环境重启客户端。

预期结果：客户端直接启动 App 内 Helper；无需克隆仓库、运行脚本或安装额外运行时；无线麦SayAll.app 主进程不必常驻。

失败判定：配置指向仓库、Node.js、源码或脚本，要求额外依赖，或只有 App 主进程运行时才能读取。

## 用例 2：默认关闭与用户授权

1. 在全新账号打开“本地 Agent 访问”。
2. 确认默认关闭，关闭状态不能创建授权。
3. 主动开启并为两个客户端分别创建授权。
4. 检查 `~/Library/Application Support/RemoteMic/MCP/v1/access.json`。

预期结果：默认关闭；两个客户端获得不同 client ID 和令牌；文件包含 `schemaVersion: 1` 和 SHA-256 哈希，不含明文令牌；目录 `0700`、文件 `0600`。

失败判定：默认开启、客户端共享凭据、磁盘保存明文令牌、权限过宽或 Agent 可绕过 App 自行授权。

## 用例 3：列出 App

1. 分别在标准 JSON 客户端和 Codex 中连接 MCP。
2. 调用 `list_transcript_apps`。
3. 使用 `schemas/list-transcript-apps.output.schema.json` 校验 structured content。

预期结果：返回 App 名称、Bundle ID、记录数和最早/最新时间；不返回任何转写正文；结构符合 Schema。

失败判定：缺少已经存在的 App，返回正文、内部文件路径、session ID、`applicationKey` 或未声明字段。

## 用例 4：时间、App、顺序与分页

1. 使用 `query_transcripts` 查询今天和最近七天。
2. 增加一个真实 Bundle ID 筛选。
3. 分别使用升序和倒序。
4. 设置 `limit: 1`，使用 `nextCursor` 读取到 `hasMore: false`。
5. 使用 `schemas/query-transcripts.output.schema.json` 校验每页。

预期结果：只返回范围和 App 内记录；顺序稳定；分页不重不漏；最后一页 `nextCursor` 为 null；每条只有九个公开字段。

失败判定：跨范围或跨 App 返回、重复、遗漏、无限循环、内部字段泄漏或 Schema 不匹配。

## 用例 5：参数拒绝

1. 把倒序 cursor 用在升序查询中。
2. 尝试 `limit: 0`、`501`、超过 100 个 Bundle ID、过长 cursor 和未知输入字段。
3. 尝试无效日期或开始时间不早于结束时间。

预期结果：所有无效请求返回明确 Tool Error，不返回历史正文；合法请求仍可继续使用。

失败判定：忽略错误参数、一次返回全部历史、崩溃、泄漏路径或正文。

## 用例 6：错误令牌、撤销和关闭

1. 把一个客户端令牌改错一个字符并连接。
2. 恢复正确令牌，确认可读。
3. 在 App 内撤销该客户端，不重启连接再次调用。
4. 确认另一个客户端仍可读，再关闭总开关并再次调用。

预期结果：错误令牌被拒绝；撤销在下一次调用立即生效且不影响其他客户端；关闭总开关后全部立即拒绝；历史不被删除。

失败判定：错误令牌可读、撤销必须重启、撤销一个影响全部、关闭后仍可读或关闭删除历史。

## 用例 7：损坏文件、安全路径与审计

1. 只在测试副本中准备损坏或过大的日期 JSON、历史目录符号链接和 `access.json` 符号链接。
2. 保留至少一个合法历史文件并查询。
3. 检查 `RemoteMic/MCP/v1/audit/`。

预期结果：损坏历史计入 `skippedFileCount` 且合法记录仍可读；符号链接被拒绝；审计只含客户端 ID、工具、时间、结果和数量，不含正文、令牌或完整响应。

失败判定：读取链接目标、修改历史、服务崩溃、审计包含正文或令牌。

## 用例 8：本地进程与网络边界

1. MCP 连接期间检查 `SayAllMCP` 进程、监听端口和 stdout/stderr。
2. 退出 Agent 客户端。

预期结果：Helper 只通过 stdin/stdout 通信，不创建 TCP/UDP/Bonjour，不常驻；stdout 只有 JSON-RPC，诊断只写 stderr；客户端退出后进程结束。

失败判定：出现网络监听、普通日志混入 stdout、退出后继续常驻或持续读取文件。

## 用例 9：v1 向后兼容

1. 在首个正式 `v1` App 中保存脱敏后的两种客户端配置、合法请求/响应 Fixture 和 `access.json` 测试副本。
2. 安装后续新版 App，保持安装路径和客户端配置不变。
3. 使用原授权、工具名、参数和分页语义重新调用。
4. 比对 `schemas/` 中所有必需输出字段。

预期结果：旧配置无需修改；旧授权继续有效；旧参数语义和封闭输出结构不变；新增输出结构使用新工具或 `v2`；新版继续读取 `RemoteMic/MCP/v1/access.json` 与 `RemoteMic/Transcripts/v1`。

失败判定：Helper 路径、`serve`、环境变量、工具名或已发布字段发生破坏性变化，旧授权失效，或新版不能读取 `v1` 数据。

## 稳定功能回归

- 本地 Agent 访问缺失/关闭、明确关闭、开启、使用后关闭四种状态不影响语音捕获、回眸写入、显示、复制和可恢复删除。
- App 删除记录后，MCP 后续查询不再返回；MCP 本身不能删除、恢复或修改记录。
- 无历史目录时返回空集合，不创建伪造历史。
- 更新 App 后 Helper 仍具有正确架构、执行权限、最低系统版本和签名。

## 日志收集

- 授权状态：`~/Library/Application Support/RemoteMic/MCP/v1/access.json`；
- 脱敏审计：`~/Library/Application Support/RemoteMic/MCP/v1/audit/`；
- Helper 诊断：由 MCP 客户端收集的 stderr；
- 对外提供前删除 client ID，绝不提供令牌和真实正文。

## 自动化、代理实测和用户实测边界

仓库自动检查 JSON Schema、配置示例和 Fixture 均为合法 JSON，并通过人工或脚本把 Schema 与 App Helper 的 `tools/list` 定义逐字段比对。App 主仓库负责 Swift 单元测试、真实 stdio 闭环、Release 构建、架构、最低系统版本和签名校验。

这些自动化不能替代真实 Codex 和标准 JSON 客户端验收，也不能证明第三方客户端不会上传返回内容。用户必须确认其选定客户端的配置位置、重启行为、分页、撤销即时生效和数据处理方式。
