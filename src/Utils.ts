import { UtilFT } from '@zwa73/utils';
import path from 'pathe';
import { FfmpegFlow } from '@zwa73/audio-utils';
import { ImageWorkerPool } from './Core';

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
     * 实际转换在 ImageWorkerPool 的常驻worker内完成, 避免全局fetch被patch污染主线程
     */
    static transcode2png = async (input: string) => {
        const {cachePath,hasCache} = await MediaCache.ensureCache('transcode2png','.png',input);
        if (hasCache) return cachePath;

        await ImageWorkerPool.convertToPng(input,cachePath);

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