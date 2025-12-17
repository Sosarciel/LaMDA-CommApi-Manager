export declare class AudioCache {
    static CACHE_PATH: string;
    /**确认缓存目录 */
    static ensureCache(category: string, ext: string, input: string): Promise<{
        hasCache: boolean;
        cachePath: string;
    }>;
    /**转为 pcm_s16le 的wav */
    static acodec2pcms16: (input: string, ar?: number) => Promise<string>;
    /**转为 pcm_s32le 的wav */
    static acodec2pcms32: (input: string) => Promise<string>;
    /** 转换为 MP3 */
    static transcode2mp3: (input: string, bitrate?: number) => Promise<string>;
    /** 转换为 OGG */
    static transcode2ogg: (input: string, quality?: number) => Promise<string>;
    /** 转换为 OGG */
    static transcode2opusogg: (input: string, bitrate: number) => Promise<string>;
}
export type InjectData = Partial<{
    /** 将消息格式化为md格式 */
    markdownFormat: (text: string) => string;
}>;
declare class _InjectTool implements Required<InjectData> {
    inject: (data: InjectData) => void;
    markdownFormat: (v: string) => string;
}
/**注入工具 */
export declare const InjectTool: _InjectTool;
export {};
