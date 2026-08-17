# 工具参考

## `list_transcript_apps`

列出当前历史中出现的 App，不返回转写正文。

输入为空对象。输出：

- `applications`：App 汇总数组；
- `applications[].applicationName`：显示名称；
- `applications[].bundleIdentifier`：Bundle ID；
- `applications[].recordCount`：记录数；
- `applications[].earliestEndedAt`：最早结束时间，ISO-8601；
- `applications[].latestEndedAt`：最新结束时间，ISO-8601；
- `skippedFileCount`：因损坏、过大或不安全而跳过的历史文件数量。

Schema：[`list-transcript-apps.input.schema.json`](../schemas/list-transcript-apps.input.schema.json)、[`list-transcript-apps.output.schema.json`](../schemas/list-transcript-apps.output.schema.json)。

## `query_transcripts`

按时间和 App 读取已授权的本地转写记录。

可选输入：

- `startedAtOrAfter`：ISO-8601，包含边界；
- `endedAtBefore`：ISO-8601，不包含边界；
- `bundleIdentifiers`：最多 100 个 Bundle ID；
- `order`：`ascending` 或 `descending`，默认倒序；
- `limit`：1–500，默认 100；
- `cursor`：上一页返回的不透明游标，最长 2048 字符。

输出：

- `records`：公开记录字段；
- `nextCursor`：下一页游标，无下一页时为 `null`；
- `hasMore`：是否还有下一页；
- `skippedFileCount`：跳过的历史文件数量。

每条记录固定包含 `id`、`startedAt`、`endedAt`、`localDateKey`、`timeZoneIdentifier`、`applicationName`、`bundleIdentifier`、`source` 和 `text`。

Schema：[`query-transcripts.input.schema.json`](../schemas/query-transcripts.input.schema.json)、[`query-transcripts.output.schema.json`](../schemas/query-transcripts.output.schema.json)。

## 错误与重试

凭据错误、授权撤销或总开关关闭时，工具调用返回 MCP Tool Error。客户端不应绕过错误直接读取磁盘，也不应无限重试。参数越界、未知字段、日期范围无效或游标与排序不匹配时，应修正请求后再调用。
