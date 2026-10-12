---
aliases: [CommApi 图像发送接口扩展]
---
# CommApi 图像发送接口扩展

## 背景

`CommApiSendTool` 原本只提供 `sendMessage` 与 `sendVoice` 两个能力，缺少图像发送。
业务侧存在发送 **jxl(JPEG XL)** 等冷门格式图片的需求，而各通讯平台对图片格式的支持范围不一，
若不统一兜底，冷门格式会被平台直接拒收。

## 目标

为 `CommApiSendTool` 扩展 `sendImage` 能力，使调用方只需给出本地图片路径，
由各平台适配器自行判断格式兼容性并在必要时转为 png。

## 设计决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 图像处理库 | **sharp** | 纯粹的图像库，与音频链路解耦 |
| ffmpeg 的职责 | **仅音频**，不为图像扩展 | `FfmpegFlow` 的输入流硬编码为 `[0:a]`，本就是音频抽象 |
| jxl 解码 | **`@jsquash/jxl` WASM** | sharp/libvips 0.35.5 未编入 libjxl，`format.jxl` 全能力为 false |
| 转换工具归属 | `MediaCache.transcode2png` | **无条件转换**，不做任何格式推断 |
| 是否转换的判断 | **各平台适配器自行判断** | 各平台白名单不同，判断属于平台私事 |
| 判断依据 | **文件扩展名** | 与 `ensureCache` 用 `path.parse().name` 生成缓存名的既有风格一致 |
| 接口形状 | 单图 `imageFilePath: string` | 与 `sendVoice` 严格对称 |

## 各平台格式策略

| 平台 | 支持格式 | 策略 |
|---|---|---|
| Telegram | jpg/jpeg/png/gif/webp | 不在列表内转 png |
| Discord | webp/png/jpg/jpeg/gif | 不在列表内转 png，转码在主线程完成 |
| KOOK | jpg/jpeg/png/gif | 不在列表内转 png |
| OB11 ×3 | 规范无白名单，协议端不一 | **统一转 png**，使用 `CQCodeTool.fileImage` |

> OB11 使用 `fileImage` 而非 `base64Image`：`fileImage` 与已在生产验证的 `fileRecord` 同构，
> 而 `base64` 形式的支持与否取决于协议端是否实现，不可预测。

## 实施内容

### 新增依赖
- `sharp@^0.35.5`
- `@jsquash/jxl@^1.3.0`

> 安装须在 workspace 根执行 `npm i <pkg> -w "@sosraciel-lamda/commapi-manager"`。
> 在模块目录内独立安装会因 `@sosraciel-lamda/*` 不在公共 registry 而报 404。

### 改动文件

| 文件 | 改动 |
|---|---|
| `src/ChatPlantformInterface.ts` | 新增 `SendImageArg` 与 `CommApiSendTool.sendImage` |
| `src/Utils.ts` | 新增 `ImageConvert.convertToPng`、`MediaCache.transcode2png` |
| `src/Telegram/Telegram.ts` | `sendPhoto` + `fromPath` |
| `src/Discord/Discord.ts` | 主线程判断与转码，桥接至 worker |
| `src/Discord/WorkerClient.ts` | `AttachmentBuilder` 发送 |
| `src/KOOK/KOOK.ts` | `uploadMedia` + 卡片 `container > image` |
| `src/OneBot/OneBot.ts` | `sendImage` 转发至 `ast` |
| `src/OneBot/ActivateSendTool/{QQ,KOOK,QQOfficial}.ts` | `fileImage` 发送 |
| `src/Utils.ts` (顺带) | `AudioCache` 重命名为 `MediaCache`，混装音视频与图像转换 |

### jxl 解码关键点

`@jsquash/jxl` 加载 wasm 走 `file://` 协议，而 Node 原生 fetch 不支持该协议，
必须在解码前修补 `globalThis.fetch`（见 `ImageConvert` 内的 `patchJxlFetch`），否则会崩溃。

**注意**：修补时须用 `Blob` 包装文件内容再交给 `Response`，不可直接传 `Buffer`。
`Buffer<ArrayBufferLike>` 与 Web 标准的 `BodyInit` 存在类型分歧，
且该分歧**随 `@types/node` 版本变化**：

| 环境 | `@types/node` | 直接传 Buffer |
|---|---|---|
| `LaMDA-Module` | 22.10.6 | 可通过 |
| `server` | 24.19.1 | **报错 TS2345** |

`Blob` 属 Web 标准类型，不受 Node 类型版本影响，两个环境均成立。
亦不可用 `as BodyInit` 断言绕过——项目规范禁止 `as` 收缩。

**Blob 写法实测证据**（2026-10-12）：
- 输入：96x48 真实 jxl（109 字节，由 `@jsquash/jxl` encoder 生成）
- 输出：png 96x48，首像素 RGB `9,180,90`，与源 `10,180,90` 一致
- 拦截计数：fetch 修补被触发 **1 次**，证明 wasm 加载确实走了 Blob 路径

> **教训**：验证类型正确性时不能只在本模块的 tsconfig 下跑 `tsc`。
> 本模块 `@types/node` 为 22，而消费方 `server` 为 24，类型定义存在差异。
> 跨环境验证命令：
> `npx tsc --noEmit --typeRoots "<server>/node_modules/@types"`

### 顺带修复

`src/OneBot/OneBot.ts` 的 `SelfIdEventTable` 类型定义存在既有编译错误（TS2536），
根因是 `EventSystem._table` 的值类型为 `Record<string, EventData>` 而非数组，
原代码用 `[number]` 索引。已修正为 `[string]`。
该问题即 `plan/README.md` 中所列的 P0「SelfIdEventTable 检测」。

## 验证

- `tsc --noEmit` 零错误
- `npm run compile` 编译通过
- `MediaCache.transcode2png` 端到端实测：png/jpg/webp **及 jxl** 均成功产出 png，
  缓存二次命中正常

## 范围说明

本次**不打通下游**，`server/` 侧未做任何改动。
`AdminServerHandler` 中手工对齐 `CommApiSendTool` 的 `sender` 对象后续需补 `sendImage`。

## 已知事项

`MediaCache.ensureCache` 的缓存键为「源文件基名 + 目标扩展名」，不含源扩展名。
因此同一基名的不同格式源（如 `a.jpg` 与 `a.jxl`）会共用同一份 `a.png` 缓存。
此行为与音频侧一致，属既定设计，本次不做改动。

---

*创建于 2026-10-12*
