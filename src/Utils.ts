import { UtilFT, UtilFunc } from '@zwa73/utils';
import path from 'pathe';
import { FfmpegFlow } from '@zwa73/audio-utils';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**jxl wasm解码函数 */
type JxlDecodeFn = (data:ArrayBuffer|Uint8Array)=>Promise<ImageData>;

/**jxl wasm是否已修补fetch */
let jxlFetchPatched = false;
/**修补fetch使其支持file://协议
 * Node原生fetch不支持file://, 而@jsquash加载wasm走该协议, 不修补会崩溃
 */
const patchJxlFetch = ()=>{
    if(jxlFetchPatched) return;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input:any, init?:any)=>{
        const urlStr = input instanceof URL ? input.href : String(input);
        if(urlStr.startsWith("file:")){
            const buffer = await fs.readFile(fileURLToPath(urlStr));
            // 必须用 Blob 包装而非直接传 Buffer:
            // Buffer 类型为 Buffer<ArrayBufferLike>, 与 Web 标准的 BodyInit 存在分歧
            // 且该分歧随 @types/node 版本变化 — LaMDA-Module 为 22(可通过),
            // 而消费方 server 为 24(报错 TS2345). Blob 属 Web 标准类型, 不受该差异影响.
            // 亦不可用 `as BodyInit` 断言, 项目规范禁止 as 收缩.
            const blob = new Blob([new Uint8Array(buffer)], { type:"application/wasm" });
            return new Response(blob, {
                headers: { "Content-Type":"application/wasm" },
            });
        }
        return originalFetch(input, init);
    };
    jxlFetchPatched = true;
}

/**图像转换工具
 * 纯转换, 不做任何格式推断, 是否转换由调用方决定
 */
export class ImageConvert{
    /**转换为 PNG
     * jxl 因 libvips 未编入 libjxl 需走 @jsquash/jxl WASM 解码, 其余格式走 sharp 原生
     * @param input  - 输入图像路径
     * @param output - 输出 png 路径
     * @async
     */
    static async convertToPng(input:string, output:string){
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
            return;
        }

        // 其余格式 sharp 原生处理
        await sharp(input)
            .png()
            .toFile(output);
    }
}

export class MediaCache{
    static CACHE_PATH = "";

    /**确认缓存目录 */
    static async ensureCache(category:string,ext:string,input:string){
        const funcCache = path.join(MediaCache.CACHE_PATH,category);
        await UtilFT.ensurePathExists(funcCache, { dir: true });
        const converTmp = path.join(funcCache, path.parse(input).name+ext);
        if (await UtilFT.pathExists(converTmp))
            return {hasCache:true,cachePath:converTmp};
        return {hasCache:false,cachePath:converTmp};;
    }

    /**转为 pcm_s16le 的wav */
    static acodec2pcms16 = async (input:string, ar?: number)=>{
        const {cachePath,hasCache} = await MediaCache.ensureCache('acodec2pcms16','.wav',input);
        if (hasCache) return cachePath;

        const flow = FfmpegFlow.pcm({codec:"pcm_s16le",format:"wav"});
        if(ar) flow.resample({rate:ar});
        await flow.apply(input,cachePath);

        return cachePath;
    };

    /**转为 pcm_s32le 的wav */
    static acodec2pcms32 = async (input:string)=>{
        const {cachePath,hasCache} = await MediaCache.ensureCache('acodec2pcms32','.wav',input);
        if (hasCache) return cachePath;

        const flow = FfmpegFlow.pcm({codec:"pcm_s32le",format:"wav"});
        await flow.apply(input,cachePath);

        return cachePath;
    };

    /** 转换为 MP3 */
    static transcode2mp3 = async (input: string, bitrate?: number) => {
        const {cachePath,hasCache} = await MediaCache.ensureCache('transcode2mp3','.mp3',input);
        if (hasCache) return cachePath;

        const flow = FfmpegFlow.mp3lame({format:"mp3",bitrate});
        await flow.apply(input,cachePath);

        return cachePath;
    };

    /** 转换为 OGG */
    static transcode2ogg = async (input: string, quality?: number) => {
        const {cachePath,hasCache} = await MediaCache.ensureCache('transcode2ogg','.ogg',input);
        if (hasCache) return cachePath;

        const flow = FfmpegFlow.vorbis({format:"ogg",quality});
        await flow.apply(input,cachePath);

        return cachePath;
    };

    /** 转换为 OGG */
    static transcode2opusogg = async (input: string, bitrate: number) => {
        const {cachePath,hasCache} = await MediaCache.ensureCache('transcode2opusogg','.ogg',input);
        if (hasCache) return cachePath;

        const flow = FfmpegFlow.opus({format:"ogg",bitrate});
        await flow.apply(input,cachePath);

        return cachePath;
    };

    /** 转换为 PNG
     * 无条件转换, 不做格式判断
     */
    static transcode2png = async (input: string) => {
        const {cachePath,hasCache} = await MediaCache.ensureCache('transcode2png','.png',input);
        if (hasCache) return cachePath;

        await ImageConvert.convertToPng(input,cachePath);

        return cachePath;
    };
}

export type  InjectData = Partial<{
    /** 将消息格式化为md格式 */
    markdownFormat:(text:string)=>string;
}>;
class _InjectTool implements Required<InjectData> {
    inject = (data:InjectData)=>{
        Object.assign(this,data);
    }
    markdownFormat = (v:string)=>v;
}
/**注入工具 */
export const InjectTool = new _InjectTool();