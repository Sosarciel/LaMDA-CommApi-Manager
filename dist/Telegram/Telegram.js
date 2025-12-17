"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramApi = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const https_proxy_agent_1 = __importDefault(require("https-proxy-agent"));
const ChatPlantformInterface_1 = require("../ChatPlantformInterface");
const utils_1 = require("@zwa73/utils");
const Utils_1 = require("../Utils");
const unwarpRegex = /telegram\.(user)\.(.+)/;
const unwarpId = (text) => {
    if (text === undefined || text == null)
        return undefined;
    const unwarped = unwarpRegex.exec(text)?.[2];
    if (unwarped != undefined)
        return unwarped;
    utils_1.SLogger.warn(`TelegramApi unwarpId 获取了一个不合规的id, 已返回原值\ntext: ${text}`);
    return text;
};
//ignore
//(node:355190) [node-telegram-bot-api] DeprecationWarning: In the future, content-type of files you send will default to "application/octet-stream". See https://github.com/yagop/node-telegram-bot-api/blob/master/doc/usage.md#sending-files for more information on how sending files has been improved and on how to disable this deprecation message altogether. (Use `node --trace-deprecation ...` to show where the warning was created)
(process.env).NTBA_FIX_350 = true;
/**Telegram接口 */
class TelegramApi extends ChatPlantformInterface_1.ListenToolBase {
    data;
    charname;
    token;
    proxyUrl;
    agent;
    bot;
    constructor(data) {
        super();
        this.data = data;
        this.charname = data.charname;
        this.token = data.token;
        this.proxyUrl = data.proxy_url;
        if (this.proxyUrl)
            this.agent = (0, https_proxy_agent_1.default)(this.proxyUrl);
        const opt = {};
        if (this.agent)
            opt.request = { agent: this.agent };
        this.bot = new node_telegram_bot_api_1.default(this.token, {
            polling: true,
            ...opt
        });
        this.bot.on('message', msg => {
            utils_1.SLogger.http(`TelegramApi.onMessage ${this.charname}`, msg);
            try {
                const { text, from } = msg;
                const { id } = from ?? {};
                if (id == undefined || text == undefined)
                    return;
                const fixedUserId = `telegram.user.${id}`;
                this.invokeEvent('message', {
                    content: text,
                    userId: fixedUserId,
                    channelId: fixedUserId,
                    sourceSet: ["telegram", fixedUserId]
                });
            }
            catch (err) {
                utils_1.SLogger.warn(`TelegramApi.onMessage 错误: `, err);
            }
        });
    }
    getData() {
        return this.data;
    }
    async sendMessage(arg) {
        try {
            const opt = {
                reply_markup: {
                    keyboard: [
                        [{ text: 'cmd:changechoice' }, { text: 'cmd:changechoice next' }, { text: 'cmd:getpreid' }],
                        [{ text: 'cmd:getaudio' }, { text: 'cmd:save' }],
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            };
            const { message, channelId } = arg;
            const fixcid = unwarpId(channelId);
            if (message == null || message.length <= 0)
                return true;
            //.replace(/^\*(.+)\*$/gm,'*$1*');
            //mdmsg = "<div>"+
            //    message
            //        .replace(/^\*(.+)\*$/gm,'<em>$1</em>') +
            //        //.replace(/^(.+)$/gm,'<p style="margin-bottom: 0.25em;">$1</p>') +
            //    "</div>";
            const mdmsg = message.replace(/\n/gm, '\n\n');
            const retryStatus = await utils_1.UtilFunc.retryPromise(async () => {
                try {
                    const resp = await this.bot.sendMessage(fixcid, mdmsg, {
                        ...opt,
                        parse_mode: "Markdown"
                    });
                    return utils_1.Success;
                }
                catch {
                    return undefined;
                }
            }, v => v ?? utils_1.Failed, {
                tryDelay: 1000, tryInterval: -1, count: 3, logFlag: "TelegramApi.sendMessage"
            });
            if (retryStatus.completed == undefined) {
                utils_1.SLogger.warn(`TelegramApi.sendMessage 发送md格式失败 尝试发送普通消息\nmdmsg: ${mdmsg}`);
                const resp = await this.bot.sendMessage(fixcid, message, opt);
            }
        }
        catch (err) {
            utils_1.SLogger.warn(`TelegramApi.sendMessage 错误: `, err, `Arg: ${utils_1.UtilFunc.stringifyJToken(arg, { space: 2, compress: true })}`);
            return false;
        }
        return true;
    }
    async sendVoice(arg) {
        const { voiceFilePath, userId } = arg;
        const fixuid = unwarpId(userId);
        const transfp = await Utils_1.AudioCache.transcode2opusogg(voiceFilePath, 256);
        //const buffer = await fs.promises.readFile(transfp);
        //await this.bot.sendAudio(userId,buffer,{},{filename:'voice.m4a'});
        await this.bot.sendVoice(fixuid, transfp);
        return true;
    }
}
exports.TelegramApi = TelegramApi;
