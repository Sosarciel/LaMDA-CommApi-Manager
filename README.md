# CommApi-Manager

通信 API 管理器，支持多种即时通讯平台的统一接口。

**支持平台**: Telegram, Discord, OneBot, KOOK, QQ官方

## 发信能力

`CommApiSendTool` 提供三个统一能力，各平台适配器各自实现：

| 能力 | 参数 | 说明 |
|---|---|---|
| `sendMessage` | `message: string` | 发送文本 |
| `sendVoice` | `voiceFilePath: string` | 发送音频，各平台自行转码 |
| `sendImage` | `imageFilePath: string` | 发送图片，各平台自行判断格式并压缩/转换 |

图像转换由 `MediaCache` 提供（`transcode2webp` / `transcode2png`）：
- 在**常驻 worker 线程**内执行，隔离 sharp 与 jxl WASM，不阻塞主线程
- `MediaCache` 为**纯转换工具**，不做格式推断——是否转换由各平台适配器自行判断
- 支持 webp 的平台（Telegram/Discord）压缩为 webp；其余平台白名单直发，不支持的转 png
- **不做同格式平转**（png→png、webp→webp 均跳过）

详见 [[plan/image-send-extension]]

---

## 📋 实施计划

- [[plan/README|查看所有计划]]

---

*最后更新: 2026-10-12*
