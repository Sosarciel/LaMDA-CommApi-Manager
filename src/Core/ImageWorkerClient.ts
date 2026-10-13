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
}

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

/**图像转换 worker 线程
 * 承担 sharp 与 @jsquash/jxl 的实际转换工作
 * 产物直接落盘, 不经主线程内存传输
 */
class ImageWorkerClient implements ImageWorkerInterface{
    /**转换为 PNG
     * jxl 因 libvips 未编入 libjxl 需走 @jsquash/jxl WASM 解码, 其余格式走 sharp 原生
     * @param arg - 转换参数
     * @returns 是否转换成功
     * @async
     */
    async convertToPng(arg:{ input:string; output:string }):Promise<boolean>{
        const { input, output } = arg;
        try{
            // JXL 单独走 WASM 解码
            if(path.extname(input).toLowerCase() === '.jxl'){
                patchJxlFetch();
                const fileBuffer = await fs.readFile(input);
                const decodeJxl = await UtilFunc.dynamicImport<JxlDecodeFn>("@jsquash/jxl/decode.js");
                const image = await decodeJxl!(fileBuffer);

                await sharp(Buffer.from(image.data.buffer), {
                    raw:{
                        width   : image.width,
                        height  : image.height,
                        channels: 4,
                    },
                })
                .png()
                .toFile(output);
                return true;
            }

            // 其余格式 sharp 原生处理
            await sharp(input)
                .png()
                .toFile(output);
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
