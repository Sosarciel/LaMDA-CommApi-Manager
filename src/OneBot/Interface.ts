import { assertType } from "@zwa73/utils";
import { KookActiveSendToolCtor, QQOfficialActiveSendToolCtor, QQActiveSendToolCtor } from "./ActivateSendTool";
import { SendTool } from "@/src/ChatPlantformInterface";




type Subtype = 'kook'|'qq'|'qq_official';

export type OneBotUserId  = `${Subtype}.user.${string}`;
export type OneBotGroupId = `${Subtype}.group.${string}`;
export type OneBotSubtypeId = `onebot.${Subtype}`;
export type OneBotSource = OneBotUserId | OneBotGroupId | OneBotSubtypeId;

/**OneBot初始化选项 */
export type OneBotServiceData = {
    /**绑定角色名 */
    charname:string;
    /**监听端口 */
    listen_port:number;
    /**发信端口 */
    send_port:number;
    /**子类型 */
    subtype:Subtype;
    /**自身的user_id 用于避免消息回环 在共用listener时判断消息发送目标 */
    self_id:string;
    /**在群消息时无需at也会响应 默认 false */
    without_at?:boolean;
}


export const SubtypeDefineTable = {
    kook:{
        flag :'kook',
        astCtor:KookActiveSendToolCtor,
    },
    qq:{
        flag :'qq',
        astCtor:QQActiveSendToolCtor,
    },
    qq_official:{
        flag :'qq_official',
        astCtor:QQOfficialActiveSendToolCtor,
    },
} as const;

export type SubtypeDefine = {
    flag:Subtype;
    astCtor:(port:number)=>SendTool;
}
assertType<Record<Subtype,SubtypeDefine>>(SubtypeDefineTable);