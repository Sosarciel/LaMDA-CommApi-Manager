import { ServiceConfig, ServiceManager, ServiceManagerBaseConfig } from "@zwa73/service-manager";
import { TelegramServiceData, TelegramApi } from "./Telegram";
import { DiscordApi, DiscordServiceData } from "./Discord";
import { DataStore, EventSystem, None, SLogger, UtilFunc } from "@zwa73/utils";
import { AudioCache, InjectData, InjectTool } from "./Utils";
import { OneBotApi, OneBotServiceData } from "./OneBot";
import { KOOKApi, KOOKServiceData } from "./KOOK";
import { AnyCommType, MessageEventData } from "./ChatPlantformInterface";


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

/**基础监听器事件表 */
export type CommApiManagerListenerEventTable ={
    /**文本消息事件 */
    message:(data:MessageEventData&{instancePack:Pack})=>void;
}
type Pack = Exclude<Awaited<ReturnType<ServiceManager<CtorTable>['getService']>>,undefined>;
class _CommApiManager extends EventSystem<CommApiManagerListenerEventTable>{
    mgr?:ServiceManager<CtorTable>;
    constructor(){
        super();
    }
    static from(opt:CommApiManagerOption){
        const ins = new _CommApiManager();
        const mgr = ServiceManager.from({
            configTable:opt.serviceTable,
            ctorTable:CtorTable,
        });
        ins.bindMgr(mgr);
        return ins;
    }
    async bindMgr(ref:ServiceManager<CtorTable>){
        await this.unbindMgr();
        this.mgr = ref;
        const bindFunc=(serviceType:AnyCommType)=> (instancePack:Pack)=>{
                const {instance,name} = instancePack;
                instance.registerEvent('message',{handler:async (data)=>{
                    try{
                        await this.invokeEvent('message',{
                            ...data, instancePack
                        });
                    }catch(e){
                        SLogger.warn(`CommApiManagerBridge 事件处理错误 服务:${name} 错误:`,e);
                    }
                },id:'CommApiManagerBridge'});
            };
        await ref.procServiceByType({
            Discord : bindFunc('discord' ),
            Telegram: bindFunc('telegram'),
            OneBot  : bindFunc('onebot'  ),
            KOOK    : bindFunc('kook'    ),
        });
    }
    async unbindMgr(){
        if(this.mgr==null) return;
        const unbindFunc=(serviceType:AnyCommType)=> (pack:Pack)=>{
                const {instance} = pack;
                instance.unregisterEvent('message','CommApiManagerBridge');
            };
        await this.mgr?.procServiceByType({
            Discord : unbindFunc('discord' ),
            Telegram: unbindFunc('telegram'),
            OneBot  : unbindFunc('onebot'  ),
            KOOK    : unbindFunc('kook'    ),
        });
    }
    invoke:ServiceManager<CtorTable>['invoke'] = function (this:_CommApiManager,...args: any[]){
        return (this.mgr!.invoke as any)(...args) ?? None;
    }
}


/**通讯接口管理器 需先调用init */
export const CommApiManager = UtilFunc.createInjectable({
    initInject(opt:CommApiManagerOption){
        AudioCache.CACHE_PATH = opt.cacheDir;
        InjectTool.inject(opt.inject);
        return _CommApiManager.from(opt);
    }
});
export type CommApiManager = typeof CommApiManager;
//void (async()=>{
//    const ts = await CommApiManager.getServiceFromType('Telegram');
//    ts.forEach(t=>t.instance.)
//    const vs = await CommApiManager.getVaildService((t)=>true);
//    vs.forEach(t=>t.)
//})();

