import { KOOKWebsocketClient } from "@sosraciel-lamda/kook-protoclient";
import { BaseCommInterface, ListenToolBase, SendMessageArg, SendVoiceArg } from "../ChatPlantformInterface";
import { KOOKServiceData } from "./Interface";
export declare class KOOKApi extends ListenToolBase implements BaseCommInterface {
    data: KOOKServiceData;
    charname: string;
    client: KOOKWebsocketClient;
    constructor(data: KOOKServiceData);
    sendMessage(arg: SendMessageArg): Promise<boolean>;
    sendVoice(arg: SendVoiceArg): Promise<boolean>;
    getData(): KOOKServiceData;
}
