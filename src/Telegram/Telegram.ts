import { Bot, ReplyKeyboardBuilder } from 'node-telegram-bot-api';
import { fromPath } from 'node-telegram-bot-api/node';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { CommApiInterface, CommApiListenToolBase, SendMessageArg, SendVoiceArg } from '../ChatPlantformInterface';
import { Failed, SLogger, Success, UtilFunc } from '@zwa73/utils';
import { AudioCache } from '../Utils';
import { TelegramServiceData, TelegramUserId } from './Interface';
import { TextClipper } from '@sosraciel-lamda/text-processor';

const unwarpRegex = /telegram\.(user)\.(.+)/;
const unwarpId = (text?: string) => {
    if (text === undefined || text == null) return undefined;
    const unwarped = unwarpRegex.exec(text)?.[2];
    if (unwarped != undefined) return unwarped;
    SLogger.warn(`TelegramApi unwarpId 获取了一个不合规的id, 已返回原值\ntext: ${text}`);
    return text;
};

/** Telegram 接口 (v2) */
export class TelegramApi extends CommApiListenToolBase implements CommApiInterface {
    charname: string;
    token: string;
    proxyUrl?: string;
    bot: Bot;

    constructor(private data: TelegramServiceData) {
        super();
        this.charname = data.charname;
        this.token = data.token;
        this.proxyUrl = data.proxy_url;

        // v2 基于标准 fetch 打造；Node 端使用 undici 配置全局网络代理
        if (this.proxyUrl) {
            const dispatcher = new ProxyAgent(this.proxyUrl);
            setGlobalDispatcher(dispatcher);
        }

        this.bot = new Bot(this.token,{
            timeoutMs:15000,
        });

        // v2 异常边界兜底，防止单个消息处理器异常阻断轮询
        this.bot.catch((err, ctx) => {
            SLogger.warn(`TelegramApi.onMessage 错误 (Update ID: ${ctx.update?.update_id}): `, err);
        });

        // v2 采用中间件 Context 风格
        this.bot.on('message', async (ctx) => {
            const msg = ctx.message;
            if (!msg) return;

            SLogger.http(`TelegramApi.onMessage ${this.charname}`, msg);
            try {
                const { text, from } = msg;
                const id = from?.id;
                if (id == undefined || text == undefined) return;

                const fixedUserId: TelegramUserId = `telegram.user.${id}`;
                this.invokeEvent('message', {
                    content: text,
                    userId: fixedUserId,
                    channelId: fixedUserId,
                    sourceSet: ['telegram', fixedUserId]
                });
            } catch (err) {
                SLogger.warn(`TelegramApi.onMessage 错误: `, err);
            }
        });

        // 启动轮询（内置指数退避重试，免去挂死烦恼）
        this.bot.startPolling(undefined,{
            timeout:10,
        }).catch(err => {
            SLogger.error(`TelegramApi startPolling 启动失败: `, err);
        });
    }

    getData() {
        return this.data;
    }

    async sendMessage(arg: SendMessageArg) {
        try {
            const { message, channelId } = arg;
            const fixcid = unwarpId(channelId)!;

            if (message == null || message.length <= 0) return true;

            // v2 可使用 ReplyKeyboardBuilder 流式构建键盘
            const replyMarkup = new ReplyKeyboardBuilder()
                .text('cmd:changechoice prev').text('cmd:changechoice next').text('cmd:getpreid')
                .row()
                .text('cmd:getaudio').text('cmd:save')
                .build({ resize_keyboard: true, one_time_keyboard: true });
            //.replace(/^\*(.+)\*$/gm,'*$1*');
            //mdmsg = "<div>"+
            //    message
            //        .replace(/^\*(.+)\*$/gm,'<em>$1</em>') +
            //        //.replace(/^(.+)$/gm,'<p style="margin-bottom: 0.25em;">$1</p>') +
            //    "</div>";
            const clip = (text: string) => TextClipper.clipMessage({
                text, maxLength: 3800, minLength: 3000,
                separators: [
                    /\r?\n/,
                    /[:：。；？！.;?!\n…~]/
                ],
            });
            const mdmsgList = clip(message.replace(/\n/gm, '\n\n'));

            const retryStatus = await UtilFunc.retryPromise(async () => {
                try {
                    for (const mdmsg of mdmsgList) {
                        // v2 统一使用 bot.api.<method>({ 单对象参数 })
                        await this.bot.api.sendMessage({
                            chat_id: fixcid,
                            text: mdmsg,
                            parse_mode: 'Markdown',
                            reply_markup: replyMarkup
                        });
                    }
                    return Success;
                } catch {
                    return undefined;
                }
            }, v => v ?? Failed, {
                tryDelay: 1000, tryInterval: -1, count: 3, logFlag: 'TelegramApi.sendMessage'
            });

            if (retryStatus.completed == undefined) {
                SLogger.warn(`TelegramApi.sendMessage 发送md格式失败 尝试发送普通消息`);
                for (const idx in mdmsgList) SLogger.warn(`mdmsg[${idx}]: ${mdmsgList[idx]}`);
                const msgList = clip(message);
                for (const msg of msgList) {
                    await this.bot.api.sendMessage({
                        chat_id: fixcid,
                        text: msg,
                        reply_markup: replyMarkup
                    });
                }
            }
        } catch (err) {
            SLogger.warn(`TelegramApi.sendMessage 错误: `, err, `Arg: ${UtilFunc.stringifyJToken(arg, { space: 2, compress: true })}`);
            return false;
        }
        return true;
    }

    async sendVoice(arg: SendVoiceArg) {
        const { voiceFilePath, userId } = arg;
        const fixuid = unwarpId(userId)!;
        const transfp = await AudioCache.transcode2opusogg(voiceFilePath, 256);

        // v2 上传本地磁盘文件需使用 fromPath 包装
        await this.bot.api.sendVoice({
            chat_id: fixuid,
            voice: await fromPath(transfp)
        });
        return true;
    }
}