import { SendTool } from "../ChatPlantformInterface";
type Subtype = 'kook' | 'qq' | 'qq_official';
/**OneBot初始化选项 */
export type OneBotServiceData = {
    /**绑定角色名 */
    charname: string;
    /**监听端口 */
    listen_port: number;
    /**发信端口 */
    send_port: number;
    /**子类型 */
    subtype: Subtype;
    /**自身的user_id 用于避免消息回环 在共用listener时判断消息发送目标 */
    self_id: string;
    /**在群消息时无需at也会响应 默认 false */
    without_at?: boolean;
};
export declare const SubtypeDefineTable: {
    kook: {
        flag: string;
        astCtor: (port: number) => SendTool;
    };
    qq: {
        flag: string;
        astCtor: (port: number) => SendTool;
    };
    qq_official: {
        flag: string;
        astCtor: (port: number) => SendTool;
    };
};
export type SubtypeDefine = {
    flag: string;
    astCtor: (port: number) => SendTool;
};
export {};
