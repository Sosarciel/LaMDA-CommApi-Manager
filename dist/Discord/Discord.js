"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordApi = void 0;
const utils_1 = require("@zwa73/utils");
const worker_threads_1 = require("worker_threads");
const path_1 = __importDefault(require("path"));
const ChatPlantformInterface_1 = require("../ChatPlantformInterface");
const Utils_1 = require("../Utils");
const unwarpRegex = /discord\.(user|guild|channel)\.(.+)/;
const unwarpId = (text) => {
    if (text === undefined || text == null)
        return undefined;
    const unwarped = unwarpRegex.exec(text)?.[2];
    if (unwarped != undefined)
        return unwarped;
    utils_1.SLogger.warn(`DiscordApi unwarpId 获取了一个不合规的id, 已返回原值\ntext: ${text}`);
    return text;
};
/**Discord接口 */
class DiscordApi extends ChatPlantformInterface_1.ListenToolBase {
    data;
    worker;
    taskMap = {};
    charname;
    bridge;
    constructor(data) {
        super();
        this.data = data;
        this.charname = data.charname;
        this.startWorker();
    }
    startWorker() {
        this.worker = new worker_threads_1.Worker(path_1.default.join(__dirname, 'WorkerClient.js'), { workerData: this.data });
        this.bridge = utils_1.Bridge.create({
            client: this,
            send: (data) => this.worker?.postMessage(data),
            init: (onData) => this.worker?.on('message', onData),
        });
        this.worker.on('exit', async (code) => {
            utils_1.SLogger.error(`DiscordWorkerClient 关闭 ${code}, 等待2秒后重启...`);
            await (0, utils_1.sleep)(2000);
            this.startWorker(); // 自动重启工作线程
        });
        this.worker.on('error', (err) => {
            utils_1.SLogger.error(`DiscordWorkerClient 错误: ${err.message}`);
        });
    }
    getData() {
        return this.data;
    }
    log(level, message) {
        utils_1.SLogger.log(level, message);
    }
    async sendMessage(arg) {
        return this.bridge?.sendMessage({ ...arg,
            userId: unwarpId(arg.userId),
            channelId: unwarpId(arg.channelId),
        }) ?? false;
    }
    async sendVoice(arg) {
        const wavpath = await Utils_1.AudioCache.acodec2pcms16(arg.voiceFilePath);
        return this.bridge?.sendVoice({ ...arg,
            userId: unwarpId(arg.userId),
            channelId: unwarpId(arg.channelId),
            voiceFilePath: wavpath }) ?? false;
    }
}
exports.DiscordApi = DiscordApi;
