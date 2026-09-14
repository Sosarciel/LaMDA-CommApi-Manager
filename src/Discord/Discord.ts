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

export class Backoff {
    /**初始重试 */
    baseDelay: number;
    /**单次最大退避 */
    maxDelay: number;
    /**稳定运行窗口 */
    stableWindow: number;
    /**退避乘数 */
    factor: number;
    /**重试计数器 */
    private retryCount = 0;
    /**上一次开始时间 */
    private lastStepTime = Date.now();

    constructor(param?: {
        /**初始重试 默认 5秒 */
        baseDelay?: number;
        /**单次最大退避 默认 15分钟 */
        maxDelay?: number;
        /**稳定运行窗口 默认 30分钟 */
        stableWindow?: number;
        /**退避乘数 默认 2 */
        factor?: number;
    }) {
        const {
            baseDelay = 5 * 1000,
            factor = 2,
            maxDelay = 15 * 60 * 1000,
            stableWindow = 30 * 60 * 1000,
        } = param??{};
        this.baseDelay      = baseDelay;
        this.maxDelay       = maxDelay;
        this.stableWindow   = stableWindow;
        this.factor         = factor;
    }

    /**每次触发崩溃重连时调用一次
     * 自动判断是否属于 30 分钟内的连续重试，并返回应等待的延迟（毫秒）
     */
    step() {
        const now = Date.now();
        const uptime = now - this.lastStepTime;

        if (uptime >= this.stableWindow) {
            this.retryCount = 0;
        }
        this.lastStepTime = now;

        const delay = Math.min(this.baseDelay * Math.pow(this.factor, this.retryCount), this.maxDelay);
        this.retryCount++;

        return {
            delay,
            retryCount: this.retryCount,
            uptime,
        };
    }

    reset() {
        this.retryCount = 0;
        this.lastStepTime = 0;
    }
}



/**Discord接口 */
export class DiscordApi extends CommApiListenToolBase implements CommApiInterface,DiscordWorkerServerInterface{
    worker?:Worker;
    taskMap:PRecord<string,(arg:boolean)=>void> = {};
    charname:string;
    bridge?:BridgeInterface<CommApiSendTool>;
    backoff = new Backoff();

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

            // WorkerClient 均为耗时网络操作, 设为需accept且不允许重试
            needAccept:true,
            acceptedRetry:0,
            acceptedTimeout:0,
        });
        this.worker.on('exit', async (code) => {
            const { delay, retryCount, uptime } = this.backoff.step();

            SLogger.error(
                `DiscordWorkerClient 关闭 (退出码: ${code}), 本次运行: ${Math.round(uptime / 1000)}s, ` +
                `第 ${retryCount} 次重试, 将在 ${Math.round(delay / 1000)} 秒后重启...`
            );

            await sleep(delay);
            this.startWorker();
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
