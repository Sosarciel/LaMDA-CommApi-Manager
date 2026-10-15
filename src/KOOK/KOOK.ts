import { CardMessage, KOOKWebsocketClient } from "@sosraciel-lamda/kook-protoclient";
import { CommApiInterface, CommApiListenToolBase, SendMessageArg, SendVoiceArg, SendImageArg } from "../ChatPlantformInterface";
import { KOOKChannelId, KOOKGuildId, KOOKServiceData, KOOKUserId } from "./Interface";
import { SLogger } from "@zwa73/utils";
import { MediaCache } from "../Utils";
import path from 'pathe';


/**KOOK 卡片图片元素支持的扩展名
 * 官方文档明确仅支持 image/jpeg, image/gif, image/png
 */
const SUPPORTED_IMG_EXT:readonly string[] = ['.jpg', '.jpeg', '.png', '.gif'];


const unwarpRegex = new RegExp(`(kook)\\.(user|channel|guild)\\.(\\d+)`);
const unwarpId = (text?:string)=>{
    if(text==null) return undefined;
    const unwarped = unwarpRegex.exec(text)?.[3];
    if(unwarped!=undefined) return unwarped;
    SLogger.warn(`KOOKApi unwarpId 获取了一个不合规的id, 已返回原值\ntext: ${text}`);
    return text;
}


const getTrans = (txt:string)=>{
    return txt
        .replace(/\(([^\s\\]+)\).+?\(\1\)/g, "")//特殊标志
        .replace(/\\\\([\[\]()*])/g, "$1")//消除转义标志
}


export class KOOKApi extends CommApiListenToolBase implements CommApiInterface{
    charname: string;
    client:KOOKWebsocketClient;
    constructor(public data:KOOKServiceData) {
        super();
        const {self_id,charname,token} = data;
        this.charname = charname;

        const client = new KOOKWebsocketClient(token);
        this.client = client;
        //设置监听
        client.registerEvent("GroupMessage",{handler:gdata=>{
            const {
                author_id,content,target_id,type,extra
            } = gdata;
            const {guild_id} = extra;

            // 跳过自身
            if (`${self_id}` == author_id) return;
            // 跳过非文本
            if(type!=1 && type!=9) return;

            // 判断被at
            const atme = content.includes(`(rol)${self_id}(rol)`);
            if (!atme) return;
            if (content.length < 2) return;

            //处理消息
            const fixedMsg = getTrans(content);
            SLogger.http(
                `KOOKApi ${self_id} 接收 GroupMessage:\n` +
                `content: ${content}\n` +
                `fixedMsg: ${fixedMsg}\n` +
                `author_id: ${author_id}\n` +
                `target_id: ${target_id}\n` +
                `guild_id: ${guild_id}`
            );

            const fixedUserId:KOOKUserId  = `kook.user.${author_id}`;
            const fixedGuildId:KOOKGuildId = `kook.guild.${guild_id}`;
            const fixedChannelId:KOOKChannelId = `kook.channel.${target_id}`;
            this.invokeEvent('message',{
                content   : fixedMsg,
                userId    : fixedUserId,
                channelId : fixedChannelId,
                sourceSet : ['kook',fixedChannelId,fixedGuildId,fixedUserId]
            });
        }});
        client.registerEvent("PrivateMessage",{handler:pdata=>{
            const {author_id,content,type} = pdata;

            // 跳过自身
            if (`${self_id}` == author_id) return;
            // 跳过非文本
            if(type!=1 && type!=9) return;

            if (content.length < 2) return;

            //处理消息
            const fixedMsg = getTrans(content);
            SLogger.http(
                `KOOKApi ${self_id} 接收 PrivateMessage:\n` +
                `content: ${content}\n` +
                `fixedMsg: ${fixedMsg}\n` +
                `author_id: ${author_id}`
            );

            const fixedUserId:KOOKUserId  = `kook.user.${author_id}`;
            this.invokeEvent('message',{
                content   : fixedMsg,
                userId    : fixedUserId,
                channelId : fixedUserId,
                sourceSet : ['kook',fixedUserId]
            });
        }});
        client.start();
    }
    async sendMessage(arg: SendMessageArg){
        const {channelId,userId,message} = arg;
        const fixedMsg = message.replace(/^\*(.+)\*$/gm,'**`*$1*`**');
        const result = await (channelId==userId
        ? this.client.apiSender.sendPrivateMsg({
            type:9,
            target_id : unwarpId(channelId)!,
            content   : fixedMsg
        })
        : this.client.apiSender.sendChannelMsg({
            type:9,
            target_id : unwarpId(channelId)!,
            content   : fixedMsg
        }));

        const successSend = result?.code==0;
        if(!successSend)
            SLogger.warn(`KOOKApi.sendMessage 消息发送失败 result:`,result);
        return successSend;
    }
    async sendVoice(arg:SendVoiceArg){
        const {channelId,userId,voiceFilePath} = arg;
        const data = await this.client.apiSender.uploadMedia(voiceFilePath);
        const successUpload = data?.code==0;
        if(!successUpload)
            SLogger.warn(`KOOKApi.sendVoice 文件上传失败 data:`,data);
        if(!successUpload) return false;

        const card = [{
            type:'card',
            modules:[{
                type:'audio',
                src:data?.data.url!,
            }]
        }]as const satisfies CardMessage;
        const result = await (channelId==userId
        ? this.client.apiSender.sendPrivateMsg({
            type:10,
            target_id : unwarpId(channelId)!,
            content   : JSON.stringify(card),
        })
        : this.client.apiSender.sendChannelMsg({
            type:10,
            target_id : unwarpId(channelId)!,
            content   : JSON.stringify(card),
        }));
        const successSend = result?.code==0;
        if(!successSend)
            SLogger.warn(`KOOKApi.sendVoice 消息发送失败 result:`,result);
        return successSend;
    }
    async sendImage(arg:SendImageArg){
        const {channelId,userId,imageFilePath} = arg;

        // 支持列表内直接发送, 其余转 png (避免同格式平转)
        const ext = path.extname(imageFilePath).toLowerCase();
        const sendPath = SUPPORTED_IMG_EXT.includes(ext)
            ? imageFilePath
            : await MediaCache.transcode2png(imageFilePath);

        const data = await this.client.apiSender.uploadMedia(sendPath);
        const successUpload = data?.code==0;
        if(!successUpload)
            SLogger.warn(`KOOKApi.sendImage 文件上传失败 data:`,data);
        if(!successUpload) return false;

        const card = [{
            type:'card',
            modules:[{
                type:'container',
                elements:[{
                    type:'image',
                    src :data?.data.url!,
                }],
            }]
        }]as const satisfies CardMessage;
        const result = await (channelId==userId
        ? this.client.apiSender.sendPrivateMsg({
            type:10,
            target_id : unwarpId(channelId)!,
            content   : JSON.stringify(card),
        })
        : this.client.apiSender.sendChannelMsg({
            type:10,
            target_id : unwarpId(channelId)!,
            content   : JSON.stringify(card),
        }));
        const successSend = result?.code==0;
        if(!successSend)
            SLogger.warn(`KOOKApi.sendImage 消息发送失败 result:`,result);
        return successSend;
    }
    getData(){
        return this.data;
    }
}