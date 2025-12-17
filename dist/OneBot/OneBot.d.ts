import { BaseCommInterface, ListenToolBase, SendMessageArg, SendTool, SendVoiceArg } from "../ChatPlantformInterface";
import { OneBotServiceData, SubtypeDefine } from "./Interface";
export declare class OneBotApi extends ListenToolBase implements BaseCommInterface {
    data: OneBotServiceData;
    ast: SendTool;
    charname: string;
    sub: SubtypeDefine;
    constructor(data: OneBotServiceData);
    sendMessage(arg: SendMessageArg): Promise<boolean>;
    sendVoice(arg: SendVoiceArg): Promise<boolean>;
    getData(): OneBotServiceData;
}
