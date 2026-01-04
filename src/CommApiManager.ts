import { ServiceConfig, ServiceManager, ServiceManagerBaseConfig } from "@zwa73/service-manager";
import { TelegramServiceData, TelegramApi } from "./Telegram";
import { DiscordApi, DiscordServiceData } from "./Discord";
import { DataStore, UtilFunc } from "@zwa73/utils";
import { AudioCache, InjectData, InjectTool } from "./Utils";
import { OneBotApi, OneBotServiceData } from "./OneBot";
import { KOOKApi, KOOKServiceData } from "./KOOK";


const CtorTable = {
    Telegram: (table:TelegramServiceData) => new TelegramApi(table),
    Discord : (table:DiscordServiceData)  => new DiscordApi (table),
    OneBot  : (table:OneBotServiceData)   => new OneBotApi  (table),
    KOOK    : (table:KOOKServiceData)     => new KOOKApi  (table),
};
type CtorTable = typeof CtorTable;

type CommApiManagerJsonTable = ServiceManagerBaseConfig & {
    instance_table: {
        [key: string]: ServiceConfig<CtorTable>;
    };
};

type CommApiManagerOption = {
    /**配置文件路径或配置表 */
    serviceTable :DataStore<CommApiManagerJsonTable>;
    /**缓存文件夹目录
     * 将会存入一些音频缓存
     */
    cacheDir    :string;
    /**需要注入的函数 */
    inject      :InjectData;
}

/**通讯接口管理器 需先调用init */
export const CommApiManager = UtilFunc.createInjectable({
    initInject(opt:CommApiManagerOption){
        AudioCache.CACHE_PATH = opt.cacheDir;
        InjectTool.inject(opt.inject);
        const mgr = ServiceManager.from({
            configTable:opt.serviceTable,
            ctorTable:CtorTable,
        });
        return mgr;
    }
});
export type CommApiManager = typeof CommApiManager;
//void (async()=>{
//    const ts = await CommApiManager.getServiceFromType('Telegram');
//    ts.forEach(t=>t.instance.)
//    const vs = await CommApiManager.getVaildService((t)=>true);
//    vs.forEach(t=>t.)
//})();

