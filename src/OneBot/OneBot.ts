import { OneBotListener } from "@sosraciel-lamda/onebot11-protoclient";
import { CommApiInterface, CommApiListenToolBase, SendMessageArg, CommApiSendTool, SendVoiceArg } from "../ChatPlantformInterface";
import { OneBotGroupId, OneBotServiceData, OneBotSubtypeId, OneBotUserId, SubtypeDefine, SubtypeDefineTable } from "./Interface";
import { SLogger, UtilCodec } from "@zwa73/utils";

//监听器池
const ListenerPool:Record<string,OneBotListener> = {};
const initListener = (port:number)=>{
    if(ListenerPool[port]==null){
        ListenerPool[port] = new OneBotListener(port);

        const listtener = ListenerPool[port];
        //设置监听
        listtener.registerEvent("GroupMessage",{handler:(gdata,qo)=>{
            SelfIdEventTable[gdata.self_id]?.GroupMessage?.(gdata,qo);
        }});
        listtener.registerEvent("PrivateMessage",{handler:(pdata,qo)=>{
            SelfIdEventTable[pdata.self_id]?.PrivateMessage?.(pdata,qo);
        }});
    }
}
type Table = OneBotListener['_table'];

// self_id -> 事件 表
// 用于在多self_id共用同端口监听器时直接使用self_id路由触发事件
// 避免多播 即避免 N个self_id的实例在创建时多次在监听器上注册事件,再各自以self_id==data.self_id过滤的 O(N) 级开销
const SelfIdEventTable:Record<string,{
    [K in keyof Table]?:NonNullable<Table[K]>[number]['handler']
}> = {};

const prefixList = Object.values(SubtypeDefineTable).map(v=>v.flag);
const unwarpRegex = new RegExp(`(${prefixList.join('|')})\\.(user|group)\\.(\\d+)`);
const unwarpId = (text?:string)=>{
    if(text==null) return undefined;
    const unwarped = unwarpRegex.exec(text)?.[3];
    if(unwarped!=undefined) return unwarped;
    SLogger.warn(`OneBotApi unwarpId 获取了一个不合规的id, 已返回原值\ntext: ${text}`);
    return text;
}


/**处理接受的文本
 * @param msg
 */
function getTrans(msg: string) {
    //替换kook标志
    msg = msg.replace(/\(([^\s\\]+)\).+?\(\1\)/g, "");
    //替换所有cq码
    msg = msg.replace(/\[CQ:.*?\][ ]*/g, "");
    //替换换行符
    msg = msg.replace(/\\+n/g, "\n");
    //kook转义
    msg = msg.replace(/\\([\(\)\*])/g, "$1");
    msg = msg.replace(/\\\\/g, "\\");
    //替换html实体
    msg = UtilCodec.decodeHtmlEntities(msg);
    return msg;
}

export class OneBotApi extends CommApiListenToolBase implements CommApiInterface{
    ast:CommApiSendTool;
    charname: string;
    sub:SubtypeDefine;
    constructor(public data:OneBotServiceData) {
        super();
        const {listen_port,send_port,subtype,charname,self_id} = data;
        this.charname = charname;
        this.sub = SubtypeDefineTable[subtype];
        this.ast = this.sub.astCtor(send_port);

        //初始化对应selfid监听器
        if(SelfIdEventTable[self_id]!=null)
            SLogger.error(`OneBotApi 初始化监听器时发现重复的self_id, 已覆盖\nself_id: ${self_id} data:`,data);
        SelfIdEventTable[self_id] = {
            PrivateMessage:(pdata)=>{
                const {message,user_id,self_id} = pdata;
                if(typeof message != "string"){
                    SLogger.warn("OneBotApi PrivateMessage 消息类型错误",message);
                    return;
                }

                // 跳过其他目标
                if (`${self_id}` != data.self_id) return;

                //处理消息
                const fixedMsg = getTrans(message);
                if (fixedMsg.includes("CQ") || fixedMsg.includes("cq") || fixedMsg.length < 2)
                    return;

                SLogger.http(`OneBotApi ${self_id} 接收 PrivateMessage:\n` +
                    `message: ${message}\n` +
                    `fixedMsg: ${fixedMsg}\n` +
                    `user_id: ${user_id}`
                );

                const fixedUserId:OneBotUserId = `${this.sub.flag}.user.${user_id}`;
                const subtypeId:OneBotSubtypeId = `onebot.${this.sub.flag}`;
                this.invokeEvent('message',{
                    content   : fixedMsg,
                    userId    : fixedUserId,
                    channelId : fixedUserId,
                    sourceSet : ['onebot',subtypeId,fixedUserId],
                });
            },
            GroupMessage:(gdata)=>{
                const {message,user_id,group_id,self_id} = gdata;
                if(typeof message != "string"){
                    SLogger.warn("OneBotApi GroupMessage 消息类型错误",message);
                    return;
                }

                // 跳过其他目标
                if (`${self_id}` != data.self_id) return;
                // 判断被at
                const qqatme = message.includes(`[CQ:at,qq=${self_id}`);
                const rolme = message.indexOf(`(rol)${self_id}(rol)`) > -1;
                const atme = rolme || qqatme || data.without_at;
                if (!atme) return;

                //处理消息
                const fixedMsg = getTrans(message);
                if (fixedMsg.includes("CQ") || fixedMsg.includes("cq") || fixedMsg.length < 2)
                    return;

                SLogger.http(
                    `OneBotApi ${self_id} 接收 GroupMessage:\n` +
                    `message: ${message}\n` +
                    `fixedMsg: ${fixedMsg}\n` +
                    `user_id: ${user_id}\n` +
                    `group_id: ${group_id}`
                );

                const fixedUserId:OneBotUserId = `${this.sub.flag}.user.${user_id}`;
                const fixedGroupId:OneBotGroupId = `${this.sub.flag}.group.${group_id}`;
                const subtypeId:OneBotSubtypeId = `onebot.${this.sub.flag}`;
                this.invokeEvent('message',{
                    content   : fixedMsg,
                    userId    : fixedUserId,
                    channelId : fixedGroupId,
                    sourceSet : ['onebot',subtypeId,fixedGroupId,fixedUserId]
                });
            },
        }
        //初始化对印端口监听器
        initListener(listen_port);
    }
    sendMessage(arg: SendMessageArg){
        return this.ast.sendMessage({...arg,
            userId    : unwarpId(arg.userId)!,
            channelId : unwarpId(arg.channelId)!
        });
    }
    sendVoice(arg:SendVoiceArg){
        return this.ast.sendVoice({...arg,
            userId    : unwarpId(arg.userId)!,
            channelId : unwarpId(arg.channelId)!
        });
    }
    getData(){
        return this.data;
    }
}