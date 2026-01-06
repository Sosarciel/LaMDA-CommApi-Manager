import { Bridge, BridgeInterface, LogLevel, PRecord, sleep, SLogger } from "@zwa73/utils";
import { Worker } from "worker_threads";
import { DiscordServiceData, DiscordWorkerServerInterface } from "./Interface";
import path from "path";
import { CommApiInterface, CommApiListenToolBase, SendMessageArg, CommApiSendTool, SendVoiceArg } from "../ChatPlantformInterface";
import { AudioCache } from "../Utils";



const unwarpRegex = /discord\.(user|guild|channel)\.(.+)/;
const unwarpId = (text?:string) =>{
    if(text===undefined || text==null) return undefined;
    const unwarped = unwarpRegex.exec(text)?.[2];
    if(unwarped!=undefined) return unwarped;
    SLogger.warn(`DiscordApi unwarpId 获取了一个不合规的id, 已返回原值\ntext: ${text}`);
    return text;
};



/**Discord接口 */
export class DiscordApi extends CommApiListenToolBase implements CommApiInterface,DiscordWorkerServerInterface{
    worker?:Worker;
    taskMap:PRecord<string,(arg:boolean)=>void> = {};
    charname:string;
    bridge?:BridgeInterface<CommApiSendTool>;

    constructor(public data:DiscordServiceData){
        super();
        this.charname = data.charname;
        this.startWorker();
    }
    startWorker() {
        this.worker = new Worker(path.join(__dirname,'WorkerClient.js'),{workerData:this.data});
        this.bridge = Bridge.create<CommApiSendTool>({
            client:this,
            send:(data)=>this.worker?.postMessage(data),
            init:(onData)=>this.worker?.on('message',onData),
        });
        this.worker.on('exit', async (code) => {
            SLogger.error(`DiscordWorkerClient 关闭 ${code}, 等待2秒后重启...`);
            await sleep(2000);
            this.startWorker(); // 自动重启工作线程
        });
        this.worker.on('error', (err) => {
            SLogger.error(`DiscordWorkerClient 错误: ${err.message}`);
        });
    }
    getData(){
        return this.data;
    }
    log(level:LogLevel,message:string){
        SLogger.log(level,message);
    }
    async sendMessage(arg: SendMessageArg){
        return this.bridge?.sendMessage({...arg,
            userId    : unwarpId(arg.userId)!,
            channelId : unwarpId(arg.channelId)!,
        })??false;
    }
    async sendVoice(arg: SendVoiceArg){
        const wavpath = await AudioCache.acodec2pcms16(arg.voiceFilePath);
        return this.bridge?.sendVoice({...arg,
            userId    : unwarpId(arg.userId)!,
            channelId : unwarpId(arg.channelId)!,
            voiceFilePath:wavpath
        })??false;
    }
}
