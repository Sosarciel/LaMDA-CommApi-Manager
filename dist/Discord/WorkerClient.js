"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const undici_1 = require("undici");
const fs_1 = __importDefault(require("fs"));
const worker_threads_1 = require("worker_threads");
const utils_1 = require("@zwa73/utils");
/**Discord接口 */
class DiscordWorkerClient {
    data;
    charname;
    token;
    proxyUrl;
    agent;
    ///**discord私聊会创建临时频道, 但不自动缓存临时频道Id  
    // * 该映射记录了 userId -> channelId  
    // */
    //UserIdChnnelIdMap:Record<string,string>={};
    //GroupIdChnnelIdMap:Record<string,string>={};
    client;
    bridge;
    constructor(data) {
        this.data = data;
        const { charname, token, proxy_url } = data;
        this.charname = charname;
        this.token = token;
        this.proxyUrl = proxy_url;
        if (this.proxyUrl)
            this.agent = new undici_1.ProxyAgent(this.proxyUrl);
        this.bridge = utils_1.Bridge.create({
            client: this,
            send: (data) => worker_threads_1.parentPort?.postMessage(data),
            init: (onData) => worker_threads_1.parentPort?.on('message', onData),
        });
        const client = new discord_js_1.Client({
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildMessages,
                discord_js_1.GatewayIntentBits.MessageContent,
                discord_js_1.GatewayIntentBits.DirectMessages,
            ],
            partials: [discord_js_1.Partials.Channel, discord_js_1.Partials.Message],
            rest: {
                agent: this.agent
            }
        });
        client.once(discord_js_1.Events.ClientReady, async () => {
            await this.bridge.log('info', 'DiscordApi 已启动');
        });
        client.on(discord_js_1.Events.MessageCreate, async (message) => {
            try {
                await this.bridge.log('http', `DiscordApi.onMessage ${this.charname} {\n` +
                    `  content:${message.content},\n` +
                    `  authorId:${message.author.id},\n` +
                    `  guildId:${message.guildId},\n` +
                    `  channelId:${message.channelId}\n` +
                    `}`);
                if (message.author.bot)
                    return;
                //console.log(message);
                //await message.reply('pong');
                const channel = message.channel;
                if (!channel.isSendable())
                    return;
                const userId = message.author.id;
                const groupId = message.guildId;
                const fixedUserId = `discord.user.${userId}`;
                const fixedGuildId = message.guildId
                    ? `discord.guild.${groupId}` : undefined;
                const fixedChannelId = `discord.channel.${channel.id}`;
                //跳过非at频道消息
                if (message.guildId != null && !message.mentions.has(client?.user?.id ?? ''))
                    return;
                await this.bridge.invokeEvent('message', {
                    content: message.content,
                    userId: fixedUserId,
                    channelId: fixedChannelId,
                    sourceSet: fixedGuildId != undefined
                        ? ["discord", fixedChannelId, fixedUserId, fixedGuildId]
                        : ["discord", fixedChannelId, fixedUserId],
                });
            }
            catch (e) {
                await this.bridge.log('warn', `DiscordApi.onMessage 错误 charName:${this.charname} error:${String(e)}`);
            }
        });
        client.login(this.token).catch(async (e) => {
            await this.bridge.log('error', `DiscordApi 登录错误 charname:${this.charname} error:${String(e)}`);
        });
        this.client = client;
    }
    async sendMessage(arg) {
        const { message, userId, channelId } = arg;
        const channel = this.client.channels.cache.get(channelId);
        if (channel?.isSendable()) {
            await channel.send(message);
            return true;
        }
        this.bridge.log('warn', `DiscordApi WorkerClient.sendMessage 发送失败\n` +
            `channelId:${channel?.id}\n` +
            `channel.isSendable:${channel?.isSendable()}\n` +
            `userId:${userId}\n` +
            `groupId:${channelId}\n` +
            `message:${message}`);
        return false;
    }
    async sendVoice(arg) {
        const { userId, voiceFilePath, channelId } = arg;
        const channel = this.client.channels.cache.get(channelId);
        if (channel?.isSendable()) {
            //const oggpath = await transcode2opusogg(voiceFilePath,256);
            const audioBuffer = await fs_1.default.promises.readFile(voiceFilePath);
            const attr = new discord_js_1.AttachmentBuilder(audioBuffer, { name: 'voice.wav' });
            await channel.send({ files: [attr] });
            return true;
        }
        this.bridge.log('warn', `DiscordApi WorkerClient.sendVoice 发送失败\n` +
            `channelId:${channel?.id}\n` +
            `channel.isSendable:${channel?.isSendable()}\n` +
            `userId:${userId}\n` +
            `channelId:${channelId}\n` +
            `voiceFilePath:${voiceFilePath}`);
        return false;
    }
}
if (worker_threads_1.parentPort) {
    const client = new DiscordWorkerClient(worker_threads_1.workerData);
    // 捕获未处理的异常
    process.on('uncaughtException', async (err) => {
        await client.bridge.log('error', `DiscordWorkerClient 未捕获的异常: ${err.message}\n${err.stack}`);
        process.exit(1); // 退出工作线程
    });
    // 捕获未处理的 Promise 拒绝
    process.on('unhandledRejection', async (reason) => {
        await client.bridge.log('error', `DiscordWorkerClient 未捕获的拒绝: ${String(reason)}`);
        process.exit(1); // 退出工作线程
    });
}
