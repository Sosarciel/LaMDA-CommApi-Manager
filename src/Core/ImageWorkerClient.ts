import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'pathe';
import sharp from 'sharp';
import { parentPort } from 'worker_threads';
import { Bridge, UtilFunc } from '@zwa73/utils';

/**jxl wasm解码函数 */
type JxlDecodeFn = (data:ArrayBuffer|Uint8Array)=>Promise<ImageData>;

/**图像转换 worker 的能力接口
 * 主线程经 Bridge 调用 worker 线程完成图像转换
 */
export type ImageWorkerInterface = {
    /**将图像转换为 PNG
     * @param arg - 转换参数
     * @returns 是否转换成功
     */
    convertToPng: (arg: { input: string; output: string }) => Promise<boolean>;
    /**将图像转换为 WEBP
     * @param arg - 转换参数
     * @returns 是否转换成功
     */
    convertToWebp: (arg: { input: string; output: string }) => Promise<boolean>;
}

/**png 目标格式参数
 * 仅做无损编码, 不启用调色板量化
 * 调色板(256色)对图像破坏严重, 视觉上可见色带, 不采用
 * 注意不可给 effort: sharp 该参数会隐式置 palette 为 true
 */
const PNG_OPTIONS = {
    compressionLevel : 9,
    palette          : false,
} as const;

/**webp 目标格式参数 */
const WEBP_OPTIONS = {
    smartSubsample: true,
    quality: 90,
    effort : 6,
} as const;

/**修补fetch使其支持file://协议
 * Node原生fetch不支持file://, 而@jsquash加载wasm走该协议, 不修补会崩溃
 *
 * 该patch只在worker线程内生效, 不会污染主线程的 globalThis.fetch
 */
const patchJxlFetch = ()=>{
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input:any, init?:any)=>{
        const urlStr = input instanceof URL ? input.href : String(input);
        if(urlStr.startsWith("file:")){
            const buffer = await fs.readFile(fileURLToPath(urlStr));
            // 必须用 Blob 包装而非直接传 Buffer:
            // Buffer 类型为 Buffer<ArrayBufferLike>, 与 Web 标准的 BodyInit 存在分歧
            // 且该分歧随 @types/node 版本变化. Blob 属 Web 标准类型, 不受该差异影响.
            // 亦不可用 `as BodyInit` 断言, 项目规范禁止 as 收缩.
            const blob = new Blob([new Uint8Array(buffer)], { type:"application/wasm" });
            return new Response(blob, {
                headers: { "Content-Type":"application/wasm" },
            });
        }
        return originalFetch(input, init);
    };
}

/**将输入图像解码为 sharp 实例
 * jxl 因 libvips 未编入 libjxl 需先经 @jsquash/jxl WASM 解码为原始像素, 其余格式由 sharp 直接读取
 * @param input - 输入图像路径
 * @returns sharp 实例
 * @async
 */
const loadImage = async (input:string)=>{
    if(path.extname(input).toLowerCase() !== '.jxl')
        return sharp(input);

    patchJxlFetch();
    const fileBuffer = await fs.readFile(input);
    const decodeJxl = await UtilFunc.dynamicImport<JxlDecodeFn>("@jsquash/jxl/decode.js");
    const image = await decodeJxl!(fileBuffer);

    return sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength), {
        raw:{
            width   : image.width,
            height  : image.height,
            channels: 4,
        },
    });
}

/**图像转换 worker 线程
 * 承担 sharp 与 @jsquash/jxl 的实际转换工作
 * 产物直接落盘, 不经主线程内存传输
 */
class ImageWorkerClient implements ImageWorkerInterface{
    /**转换为 PNG
     * @param arg - 转换参数
     * @returns 是否转换成功
     * @async
     */
    async convertToPng(arg:{ input:string; output:string }):Promise<boolean>{
        const { input, output } = arg;
        try{
            const image = await loadImage(input);
            await image.png(PNG_OPTIONS).toFile(output);
            return true;
        }catch(e){
            return false;
        }
    }

    /**转换为 WEBP
     * @param arg - 转换参数
     * @returns 是否转换成功
     * @async
     */
    async convertToWebp(arg:{ input:string; output:string }):Promise<boolean>{
        const { input, output } = arg;
        try{
            const image = await loadImage(input);
            await image.webp(WEBP_OPTIONS).toFile(output);
            return true;
        }catch(e){
            return false;
        }
    }
}

if(parentPort){
    const port = parentPort;
    const client = new ImageWorkerClient();
    Bridge.create<ImageWorkerInterface>({
        client,
        send:(data)=>port.postMessage(data),
        init:(onData)=>port.on('message',onData),
    });
}
