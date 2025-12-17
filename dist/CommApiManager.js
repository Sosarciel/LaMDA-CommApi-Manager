"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommApiManager = void 0;
const service_manager_1 = require("@zwa73/service-manager");
const Telegram_1 = require("./Telegram");
const Discord_1 = require("./Discord");
const utils_1 = require("@zwa73/utils");
const Utils_1 = require("./Utils");
const OneBot_1 = require("./OneBot");
const KOOK_1 = require("./KOOK");
const CtorTable = {
    Telegram: (table) => new Telegram_1.TelegramApi(table),
    Discord: (table) => new Discord_1.DiscordApi(table),
    OneBot: (table) => new OneBot_1.OneBotApi(table),
    KOOK: (table) => new KOOK_1.KOOKApi(table),
};
/**通讯接口管理器 需先调用init */
exports.CommApiManager = utils_1.UtilFunc.createInjectable({
    initInject(opt) {
        Utils_1.AudioCache.CACHE_PATH = opt.cacheDir;
        Utils_1.InjectTool.inject(opt.inject);
        const mgr = service_manager_1.ServiceManager.from({
            cfgPath: opt.tablePath,
            ctorTable: CtorTable,
        });
        return mgr;
    }
});
//void (async()=>{
//    const ts = await CommApiManager.getServiceFromType('Telegram');
//    ts.forEach(t=>t.instance.)
//    const vs = await CommApiManager.getVaildService((t)=>true);
//    vs.forEach(t=>t.)
//})();
