"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KookActiveSendToolCtor = void 0;
const onebot11_protoclient_1 = require("@sosraciel-lamda/onebot11-protoclient");
const Utils_1 = require("./Utils");
const utils_1 = require("@zwa73/utils");
const Utils_2 = require("../../Utils");
const fs_1 = __importDefault(require("fs"));
const KookActiveSendToolCtor = (port) => {
    const sender = new onebot11_protoclient_1.OneBotSender('127.0.0.1', port);
    return {
        async sendMessage(params) {
            const { channelId, message } = params;
            const notCQ = true;
            const nChannelId = parseInt(channelId);
            const fixmessage = message.replace(/^\*(.+)\*$/gm, '**`*$1*`**');
            await (0, utils_1.match)((0, Utils_1.chkType)(params), {
                "group_message": async () => {
                    await (0, utils_1.sleep)(500 + Math.floor(Math.random() * 500));
                    void sender.sendGroupMsg(nChannelId, fixmessage, notCQ);
                },
                "private_message": async () => {
                    await (0, utils_1.sleep)(500 + Math.floor(Math.random() * 500));
                    void sender.sendPrivateMsg(nChannelId, fixmessage, notCQ);
                }
            });
            return true;
        },
        async sendVoice(params) {
            const { channelId, voiceFilePath } = params;
            const notCQ = false;
            if (!await utils_1.UtilFT.pathExists(voiceFilePath)) {
                utils_1.SLogger.warn(`ActiveSendTool.sendVoice 错误 voiceFilePath 不存在: ${voiceFilePath}`);
                return false;
            }
            const wavpath = await Utils_2.AudioCache.acodec2pcms16(voiceFilePath);
            const data = await fs_1.default.promises.readFile(wavpath);
            const base64 = data.toString('base64');
            const voiceCQ = onebot11_protoclient_1.CQCodeTool.base64Record(base64);
            const nChannelId = parseInt(channelId);
            await (0, utils_1.match)((0, Utils_1.chkType)(params), {
                "group_message": async () => {
                    await (0, utils_1.sleep)(500 + Math.floor(Math.random() * 500));
                    void sender.sendGroupMsg(nChannelId, voiceCQ, notCQ);
                },
                "private_message": async () => {
                    await (0, utils_1.sleep)(500 + Math.floor(Math.random() * 500));
                    void sender.sendPrivateMsg(nChannelId, voiceCQ, notCQ);
                },
            });
            return true;
        }
    };
};
exports.KookActiveSendToolCtor = KookActiveSendToolCtor;
