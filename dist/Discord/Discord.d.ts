import { BridgeInterface, LogLevel, PRecord } from "@zwa73/utils";
import { Worker } from "worker_threads";
import { DiscordServiceData, DiscordWorkerServerInterface } from "./Interface";
import { BaseCommInterface, ListenToolBase, SendMessageArg, SendTool, SendVoiceArg } from "../ChatPlantformInterface";
/**Discord接口 */
export declare class DiscordApi extends ListenToolBase implements BaseCommInterface, DiscordWorkerServerInterface {
    data: DiscordServiceData;
    worker?: Worker;
    taskMap: PRecord<string, (arg: boolean) => void>;
    charname: string;
    bridge?: BridgeInterface<SendTool>;
    constructor(data: DiscordServiceData);
    startWorker(): void;
    getData(): DiscordServiceData;
    log(level: LogLevel, message: string): void;
    sendMessage(arg: SendMessageArg): Promise<boolean>;
    sendVoice(arg: SendVoiceArg): Promise<boolean>;
}
