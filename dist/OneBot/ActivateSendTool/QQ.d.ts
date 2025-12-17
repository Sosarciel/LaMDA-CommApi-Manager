import { SendTool } from "../../ChatPlantformInterface";
/**QQ主动通讯接口
 * @class
 * @param respPort - 端口号
 * @param sendType - 类型 "group_message" 或 "private_message"
 */
export declare const QQActiveSendToolCtor: (port: number) => SendTool;
