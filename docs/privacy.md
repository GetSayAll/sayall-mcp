# 隐私说明

## 本地数据流

无线麦SayAll.app 把用户主动开启后的语音转文字结果保存到本机。MCP Helper 只读取这些现有记录，通过父 Agent Host 提供的 stdin/stdout 返回，不监听网络，不调用 SayAll 云服务，也不修改历史。

`list_transcript_apps` 不返回正文。`query_transcripts` 只返回记录 ID、开始/结束时间、本地日期、时区、App 名称、Bundle ID、输入来源和本次转写文字，不返回内部 session ID、磁盘路径、`applicationKey`、窗口标题、文档名、URL、音频或捕获诊断字段。

## 第三方 AI 客户端

“本地 MCP”只说明无线麦SayAll.app 和 Helper 不主动上传。被授权的 Codex、Claude Desktop、Cursor 或其他客户端如果使用云端模型，可能把 MCP 返回内容发送给其服务商。用户应在授权前确认对应客户端的隐私政策、数据保留和训练设置。

## 本机安全边界

本功能面向用户主动授权的正常本机应用。它不能完全隔离同一 macOS 登录用户下的恶意非沙盒进程；这类进程可能尝试直接读取用户自己的 Application Support 文件。不要把访问令牌粘贴到聊天、Issue、截图、日志或版本库。
