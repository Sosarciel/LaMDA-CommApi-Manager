
import TelegramBot from 'node-telegram-bot-api';
import createHttpsProxyAgent, { HttpsProxyAgent } from 'https-proxy-agent';
import { BaseCommInterface, CommApiListenToolBase, SendMessageArg, SendVoiceArg } from '../ChatPlantformInterface';
import { Failed, SLogger, Success, UtilFunc } from '@zwa73/utils';
import { AudioCache } from '../Utils';
import { TelegramServiceData, TelegramUserId } from './Interface';


const unwarpRegex = /telegram\.(user)\.(.+)/;
const unwarpId = (text?:string) =>{
    if(text===undefined || text==null) return undefined;
    const unwarped = unwarpRegex.exec(text)?.[2];
    if(unwarped!=undefined) return unwarped;
    SLogger.warn(`TelegramApi unwarpId 获取了一个不合规的id, 已返回原值\ntext: ${text}`);
    return text;
};

//ignore
//(node:355190) [node-telegram-bot-api] DeprecationWarning: In the future, content-type of files you send will default to "application/octet-stream". See https://github.com/yagop/node-telegram-bot-api/blob/master/doc/usage.md#sending-files for more information on how sending files has been improved and on how to disable this deprecation message altogether. (Use `node --trace-deprecation ...` to show where the warning was created)
((process.env)as any).NTBA_FIX_350 = true;
/**Telegram接口 */
export class TelegramApi extends CommApiListenToolBase implements BaseCommInterface{
    charname:string;
    token: string;
    proxyUrl?:string;
    agent?: HttpsProxyAgent;
    bot:TelegramBot;

    constructor(private data:TelegramServiceData){
        super();
        this.charname = data.charname;
        this.token = data.token;
        this.proxyUrl = data.proxy_url;
        if(this.proxyUrl) this.agent = createHttpsProxyAgent(this.proxyUrl);

        const opt:{
            request?:any
        } = {};
        if(this.agent) opt.request = {agent:this.agent};

        this.bot = new TelegramBot(this.token,{
            polling:true,
            ...opt
        });
        this.bot.on('message', msg => {
            SLogger.http(`TelegramApi.onMessage ${this.charname}`,msg);
            try{
                const {text,from} = msg;
                const {id} = from??{};
                if(id==undefined || text==undefined) return;

                const fixedUserId:TelegramUserId = `telegram.user.${id}`;
                this.invokeEvent('message',{
                    content   : text,
                    userId    : fixedUserId,
                    channelId : fixedUserId,
                    sourceSet : ["telegram",fixedUserId]
                });
            }catch(err){
                SLogger.warn(`TelegramApi.onMessage 错误: `,err);
            }
        });
    }
    getData(){
        return this.data;
    }
    async sendMessage(arg:SendMessageArg) {
        try{
            const opt:TelegramBot.SendMessageOptions = {
                reply_markup:{
                    keyboard: [
                        [{text:'cmd:changechoice prev'},{text:'cmd:changechoice next'},{text:'cmd:getpreid'}],
                        [{text:'cmd:getaudio'},{text:'cmd:save'}],
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            };
            const {message,channelId} = arg;

            const fixcid = unwarpId(channelId)!;

            if(message==null || message.length<=0) return true;

            //.replace(/^\*(.+)\*$/gm,'*$1*');
            //mdmsg = "<div>"+
            //    message
            //        .replace(/^\*(.+)\*$/gm,'<em>$1</em>') +
            //        //.replace(/^(.+)$/gm,'<p style="margin-bottom: 0.25em;">$1</p>') +
            //    "</div>";
            const mdmsg = message.replace(/\n/gm,'\n\n');
            const retryStatus = await UtilFunc.retryPromise(async ()=>{
                try{
                    const resp = await this.bot.sendMessage(fixcid, mdmsg,{
                        ...opt,
                        parse_mode:"Markdown"
                    });
                    return Success;
                }catch{
                    return undefined;
                }
            },v=>v ?? Failed,{
                tryDelay:1000,tryInterval:-1,count:3,logFlag:"TelegramApi.sendMessage"
            });

            if(retryStatus.completed==undefined){
                SLogger.warn(`TelegramApi.sendMessage 发送md格式失败 尝试发送普通消息\nmdmsg: ${mdmsg}`);
                const resp = await this.bot.sendMessage(fixcid, message,opt);
            }
        }catch(err){
            SLogger.warn(`TelegramApi.sendMessage 错误: `,err,`Arg: ${UtilFunc.stringifyJToken(arg,{space:2,compress:true})}`);
            return false;
        }
        return true;
    }

    async sendVoice(arg:SendVoiceArg) {
        const {voiceFilePath,userId} = arg;
        const fixuid = unwarpId(userId)!;
        const transfp = await AudioCache.transcode2opusogg(voiceFilePath,256);
        //const buffer = await fs.promises.readFile(transfp);
        //await this.bot.sendAudio(userId,buffer,{},{filename:'voice.m4a'});
        await this.bot.sendVoice(fixuid,transfp);
        return true;
    }
}
