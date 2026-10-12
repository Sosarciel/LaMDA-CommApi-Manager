# CommApi-Manager

通信 API 管理器，支持多种即时通讯平台的统一接口。

**支持平台**: Telegram, Discord, OneBot, KOOK, QQ官方

## 发信能力

`CommApiSendTool` 提供三个统一能力，各平台适配器各自实现：

| 能力 | 参数 | 说明 |
|---|---|---|
| `sendMessage` | `message: string` | 发送文本 |
| `sendVoice` | `voiceFilePath: string` | 发送音频，各平台自行转码 |
| `sendImage` | `imageFilePath: string` | 发送图片，各平台自行判断格式兼容性 |

图像转换由 `MediaCache` 提供（基于 sharp，jxl 经 `@jsquash/jxl` WASM 解码）。
`MediaCache` 为**纯转换工具**，不做格式推断——是否转换由各平台适配器自行按扩展名判断。

详见 [[plan/image-send-extension]]

---

## 📋 实施计划

- [[plan/README|查看所有计划]]

---

*最后更新: 2026-10-12*
