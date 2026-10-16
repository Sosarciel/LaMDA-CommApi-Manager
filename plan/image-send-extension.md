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
由各平台适配器自行判断格式兼容性，并在必要时转换后再发送。

## 设计决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 图像处理库 | **sharp** | 纯粹的图像库，与音频链路解耦 |
| ffmpeg 的职责 | **仅音频**，不为图像扩展 | `FfmpegFlow` 的输入流硬编码为 `[0:a]`，本就是音频抽象 |
| jxl 解码 | **`@jsquash/jxl` WASM** | sharp/libvips 0.35.5 未编入 libjxl，`format.jxl` 全能力为 false |
| 转换工具归属 | `MediaCache.transcode2{webp,png}` | **无条件转换**，不做任何格式推断 |
| 是否转换的判断 | **各平台适配器自行判断** | 各平台白名单不同，判断属于平台私事 |
| 判断依据 | **文件扩展名** | 与 `ensureCache` 用 `path.parse().name` 生成缓存名的既有风格一致 |
| 接口形状 | 单图 `imageFilePath: string` | 与 `sendVoice` 严格对称 |
| **不做同格式平转** | 已是目标格式则直发 | png→png 这类转换纯属无效开销 |

## 各平台格式策略

| 平台 | 策略 | 依据 |
|---|---|---|
| Telegram | **压 webp**（已是 webp 则直发） | 官方未限制格式，webp 可显著减小体积 |
| Discord | **压 webp**（已是 webp 则直发） | `ALLOWED_EXTENSIONS` 含 webp |
| KOOK | 白名单 `jpg/jpeg/png/gif` 直发，其余转 png | 官方文档明确仅支持 jpeg/gif/png |
| OB11 ×3 | 白名单 `jpg/jpeg/png/gif` 直发，其余转 png | 规范无白名单，协议端不一 |

> OB11 使用 `fileImage` 而非 `base64Image`：`fileImage` 与已在生产验证的 `fileRecord` 同构，
> 而 `base64` 形式的支持与否取决于协议端是否实现，不可预测。

### 为何不使用 PNG 调色板量化

PNG 缩体积的唯一有效手段是 **调色板量化**（`palette: true`），单靠 zlib 无损压缩对照片几乎无效。
但调色板会把图像压到 **256 色**，对渐变图像产生肉眼可见的**色带**，破坏严重，故不采用。

实测（1200x800 照片类图像）：

| 方式 | 体积 | 相对源 |
|---|---|---|
| 源 png | 2685 KB | 100% |
| png 仅 zlib 无损 | 2682 KB | 99.9% ← 几乎无效 |
| png 调色板 256 色 | 546 KB | 20.3% ← 但画质破坏 |

因此 png 路径只做**无损编码**（`compressionLevel: 9`），仅用于「平台不支持原格式」的兜底。
需要真正压体积时走 **webp**。

> 注意：不可给 `png()` 传 `effort`——sharp 文档注明该参数会**隐式置 `palette: true`**。

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
| `src/Utils.ts` | 新增 `MediaCache.transcode2webp` 与 `transcode2png`，均委派给 `ImageWorkerPool` |
| `src/Core/ImageWorkerClient.ts` | **新增** worker 线程：fetch patch + jxl WASM 解码 + sharp 编码 |
| `src/Core/ImageWorkerPool.ts` | **新增** 主线程常驻单例与 Bridge 管理 |
| `src/Core/index.ts` | **新增** |
| `src/Telegram/Telegram.ts` | 压 webp + `sendPhoto` + `fromPath` |
| `src/Discord/Discord.ts` | 主线程压 webp，桥接至 worker |
| `src/Discord/WorkerClient.ts` | `AttachmentBuilder` 发送 |
| `src/KOOK/KOOK.ts` | 白名单判断 + `uploadMedia` + 卡片 `container > image` |
| `src/OneBot/OneBot.ts` | `sendImage` 转发至 `ast` |
| `src/OneBot/ActivateSendTool/Utils.ts` | **新增** `fixImagePath` 共享格式判断 |
| `src/OneBot/ActivateSendTool/{QQ,KOOK,QQOfficial}.ts` | `fileImage` 发送 |
| `src/Utils.ts` (顺带) | `AudioCache` 重命名为 `MediaCache`，混装音频与图像转换 |

### jxl 解码关键点

`@jsquash/jxl` 加载 wasm 走 `file://` 协议，而 Node 原生 fetch 不支持该协议，
必须在解码前修补 `globalThis.fetch`，否则会崩溃。

**修补被隔离在 worker 线程内**，主线程的 `globalThis.fetch` 不被触碰。

修补时须用 `Blob` 包装文件内容再交给 `Response`，不可直接传 `Buffer`。
`Buffer<ArrayBufferLike>` 与 Web 标准的 `BodyInit` 存在类型分歧，
且该分歧**随 `@types/node` 版本变化**：

| 环境 | `@types/node` | 直接传 Buffer |
|---|---|---|
| `LaMDA-Module` | 22.10.6 | 可通过 |
| `server` | 24.19.1 | **报错 TS2345** |

`Blob` 属 Web 标准类型，不受 Node 类型版本影响。亦不可用 `as BodyInit` 断言绕过——项目规范禁止 `as` 收缩。

### 转换 worker 架构

图像转换**不在主线程执行**，而是委派给常驻的 worker 线程。

```
MediaCache.transcode2{webp,png}(input)
        │  产物直接落盘, 不经内存传输
        ▼
ImageWorkerPool (主线程, 单例)  ──Bridge──▶  ImageWorkerClient (worker 线程)
   src/Core/ImageWorkerPool.ts                src/Core/ImageWorkerClient.ts
                                               ├─ patch globalThis.fetch (仅线程内)
                                               ├─ @jsquash/jxl WASM 解码 (仅 jxl 输入)
                                               └─ sharp 编码为 webp / png
```

`loadImage` 负责解码：非 jxl 交给 sharp 直接读取，jxl 先经 WASM 解码为原始像素再交给 sharp。
两种目标格式（`convertToPng` / `convertToWebp`）共用该解码入口。

**采用 worker 的三点理由**：
1. **隔离全局 patch** —— jxl 解码需改写 `globalThis.fetch`，在主线程做会污染整个进程
2. **不阻塞主线程** —— sharp 与 wasm 装载耗时且占内存
3. **适配落盘语义** —— 转换产物本就是磁盘文件，无需经主线程内存往返

`ImageWorkerPool` 惰性启动、常驻复用；worker 意外退出时自动清空句柄，
下次调用重新拉起。`ImageWorkerPool.close()` 可主动释放。

**`close()` 的细节**：`worker.terminate()` 会以**非零码**结束——这是 Node 的正常行为，
但会被 `exit` 监听误报为「异常退出」。故关闭前置 `closing` 标记加以区分。

### Bridge 超时必须放宽并禁用重发

Bridge 的默认 `timeout` 仅 **1000ms**、`retry` 为 **2**。这对秒级的图像转换远远不够，
会导致 **worker 重复执行转换**并回报重复 resolve，日志表现为：

```
[WARN]: 桥接收到重复的 response, 已跳过 response:{ "uid": "...", "type": "invoke", ... }
```

**根因不只是「慢」，而是 `await` 并不会让出事件循环。**
Emscripten 编译的 WASM 是同步代码，`decodeJxl()` 一旦开始就会跑到结束，
`await` 只是等它跑完，中途没有任何 yield 点。实测：

| 操作 | 耗时 | 事件循环心跳 | 最大卡顿 |
|---|---|---|---|
| 基线（纯异步 sleep 1000ms） | 1010ms | 32 次 | 32ms |
| sharp 读 png → 编码 | 385ms | 10 次 | 58ms |
| **jxl WASM 解码** | **1581ms** | **0 次** | — |
| jxl 解码 + sharp 编码 | 2140ms | 24 次 | **1424ms** |

**jxl 解码期间心跳为 0 —— 事件循环被 100% 独占。** 此时 worker 连
`on('message')` 回调都执行不到，后到的请求堆积在消息队列中无法回应，
主线程等满 1 秒便按 `retry` 重发，于是同一 uid 被投递多次。

**实测复现与修复对照**（3 个并发 jxl 转换，错峰 400ms）：

| 配置 | 发送次数分布 | 被重发 | 重复告警 |
|---|---|---|---|
| 默认（`timeout:1000`, `retry:2`） | `[1, 2, 2]` | 2 | **2** ← 复现 |
| `timeout: 600_000`, `retry: 0` | `[1, 1, 1]` | **0** | **0** |

当前配置为**单段模式**（不启用 `needAccept`），直接等待最终 `resolve`：

```ts
Bridge.create<ImageWorkerInterface>({
    timeout: 600_000,   // 放宽以覆盖转换本体
    retry  : 0,         // 转换有副作用, 禁止重发
    client:{}, send, init,
});
```

**注意**：这只消除了重发，并未解决 WASM 阻塞事件循环本身。
多个转换实际是**串行**执行的（实测 3 次解码共 4255ms，与串行相符）。
如需真正并发，需为每个转换启用独立 worker —— 当前按需求保留常驻单例。

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

- `tsc --noEmit` 零错误（模块自身 `@types/node` 22 与 test-server 的 24 两套环境均通过）
- `npm run compile` 编译通过
- 端到端实测（使用编译产物 `dist/`，经 worker 线程转换）：
  - **jxl 解码**：400x300 真实 jxl（由 `@jsquash/jxl` encoder 生成）→ webp / png，
    首像素 RGB 与源完全一致（`60,60,200`）
  - **webp 压缩**：1000x700 照片类 png 284.9 KB → webp 108.6 KB（**38.1%**）
  - **png 兜底**：同图转 png 为无损编码，体积基本持平（不启用调色板量化）
  - **主线程 `globalThis.fetch` 未被改动** —— worker 隔离生效
  - 缓存二次命中正常

## 范围说明

`CommApi-Manager` 侧已完成。
`test-server` 的 Admin 链路已同步补上 `sendImage`：
`AdminServerHandler.sender` 转发至 `bridge.onImage`，`AdminClient.onImage` 打印图片路径。

`server/`（小规模生产环境）尚未同步，其 `AdminServerHandler` 同样需补 `sendImage`。

## 已知事项

`MediaCache.ensureCache` 的缓存键为「源文件基名 + 目标扩展名」，不含源扩展名。
因此同一基名的不同格式源（如 `a.jpg` 与 `a.jxl`）会共用同一份 `a.png` 缓存。
此行为与音频侧一致，属既定设计，本次不做改动。

---

*创建于 2026-10-12*
