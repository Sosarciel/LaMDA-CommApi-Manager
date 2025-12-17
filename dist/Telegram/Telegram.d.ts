import TelegramBot from 'node-telegram-bot-api';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { BaseCommInterface, ListenToolBase, SendMessageArg, SendVoiceArg } from '../ChatPlantformInterface';
import { TelegramServiceData } from './Interface';
/**Telegram接口 */
export declare class TelegramApi extends ListenToolBase implements BaseCommInterface {
    private data;
    charname: string;
    token: string;
    proxyUrl?: string;
    agent?: HttpsProxyAgent;
    bot: TelegramBot;
    constructor(data: TelegramServiceData);
    getData(): TelegramServiceData;
    sendMessage(arg: SendMessageArg): Promise<boolean>;
    sendVoice(arg: SendVoiceArg): Promise<boolean>;
}
