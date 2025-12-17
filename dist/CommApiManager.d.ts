import { ServiceManager } from "@zwa73/service-manager";
import { TelegramServiceData, TelegramApi } from "./Telegram";
import { DiscordApi, DiscordServiceData } from "./Discord";
import { InjectData } from "./Utils";
import { OneBotApi, OneBotServiceData } from "./OneBot";
import { KOOKApi, KOOKServiceData } from "./KOOK";
type CommApiManagerOption = {
    /**配置文件路径 */
    tablePath: string;
    /**缓存文件夹目录
     * 将会存入一些音频缓存
     */
    cacheDir: string;
    /**需要注入的函数 */
    inject: InjectData;
};
/**通讯接口管理器 需先调用init */
export declare const CommApiManager: ServiceManager<{
    Telegram: (table: TelegramServiceData) => TelegramApi;
    Discord: (table: DiscordServiceData) => DiscordApi;
    OneBot: (table: OneBotServiceData) => OneBotApi;
    KOOK: (table: KOOKServiceData) => KOOKApi;
}> & {
    initInject: (opt: CommApiManagerOption) => void;
    waitInitInject: () => Promise<void>;
};
export type CommApiManager = typeof CommApiManager;
export {};
