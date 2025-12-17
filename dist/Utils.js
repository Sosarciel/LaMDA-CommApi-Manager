"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InjectTool = exports.AudioCache = void 0;
const utils_1 = require("@zwa73/utils");
const pathe_1 = __importDefault(require("pathe"));
const audio_utils_1 = require("@zwa73/audio-utils");
class AudioCache {
    static CACHE_PATH = "";
    /**确认缓存目录 */
    static async ensureCache(category, ext, input) {
        const funcCache = pathe_1.default.join(AudioCache.CACHE_PATH, category);
        await utils_1.UtilFT.ensurePathExists(funcCache, { dir: true });
        const converTmp = pathe_1.default.join(funcCache, pathe_1.default.parse(input).name + ext);
        if (await utils_1.UtilFT.pathExists(converTmp))
            return { hasCache: true, cachePath: converTmp };
        return { hasCache: false, cachePath: converTmp };
        ;
    }
    /**转为 pcm_s16le 的wav */
    static acodec2pcms16 = async (input, ar) => {
        const { cachePath, hasCache } = await AudioCache.ensureCache('acodec2pcms16', '.wav', input);
        if (hasCache)
            return cachePath;
        const flow = audio_utils_1.FfmpegFlow.pcm({ codec: "pcm_s16le", format: "wav" });
        if (ar)
            flow.resample({ rate: ar });
        await flow.apply(input, cachePath);
        return cachePath;
    };
    /**转为 pcm_s32le 的wav */
    static acodec2pcms32 = async (input) => {
        const { cachePath, hasCache } = await AudioCache.ensureCache('acodec2pcms32', '.wav', input);
        if (hasCache)
            return cachePath;
        const flow = audio_utils_1.FfmpegFlow.pcm({ codec: "pcm_s32le", format: "wav" });
        await flow.apply(input, cachePath);
        return cachePath;
    };
    /** 转换为 MP3 */
    static transcode2mp3 = async (input, bitrate) => {
        const { cachePath, hasCache } = await AudioCache.ensureCache('transcode2mp3', '.mp3', input);
        if (hasCache)
            return cachePath;
        const flow = audio_utils_1.FfmpegFlow.mp3lame({ format: "mp3", bitrate });
        await flow.apply(input, cachePath);
        return cachePath;
    };
    /** 转换为 OGG */
    static transcode2ogg = async (input, quality) => {
        const { cachePath, hasCache } = await AudioCache.ensureCache('transcode2ogg', '.ogg', input);
        if (hasCache)
            return cachePath;
        const flow = audio_utils_1.FfmpegFlow.vorbis({ format: "ogg", quality });
        await flow.apply(input, cachePath);
        return cachePath;
    };
    /** 转换为 OGG */
    static transcode2opusogg = async (input, bitrate) => {
        const { cachePath, hasCache } = await AudioCache.ensureCache('transcode2opusogg', '.ogg', input);
        if (hasCache)
            return cachePath;
        const flow = audio_utils_1.FfmpegFlow.opus({ format: "ogg", bitrate });
        await flow.apply(input, cachePath);
        return cachePath;
    };
}
exports.AudioCache = AudioCache;
class _InjectTool {
    inject = (data) => {
        Object.assign(this, data);
    };
    markdownFormat = (v) => v;
}
/**注入工具 */
exports.InjectTool = new _InjectTool();
