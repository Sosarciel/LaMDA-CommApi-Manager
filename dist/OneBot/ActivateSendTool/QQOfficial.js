"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QQOfficialActiveSendToolCtor = void 0;
const utils_1 = require("@zwa73/utils");
const onebot11_protoclient_1 = require("@sosraciel-lamda/onebot11-protoclient");
const Utils_1 = require("./Utils");
const Utils_2 = require("../../Utils");
const QQOfficialActiveSendToolCtor = (port) => {
    const sender = new onebot11_protoclient_1.OneBotSender('127.0.0.1', port);
    return {
        async sendMessage(params) {
            const { channelId, message } = params;
            const notCQ = true;
            const nChannelId = parseInt(channelId);
            await (0, utils_1.match)((0, Utils_1.chkType)(params), {
                "group_message": async () => {
                    if (notCQ != true)
                        return void sender.sendGroupMsg(nChannelId, message, notCQ);
                    let firstClip = true;
                    const pdelay = message.length * 100;
                    const rdelay = parseInt((Math.random() * pdelay));
                    if (firstClip) {
                        firstClip = false;
                        await utils_1.UtilFunc.sleep(500 + rdelay);
                    }
                    else
                        await utils_1.UtilFunc.sleep(1000 + pdelay + rdelay);
                    void sender.sendGroupMsg(nChannelId, message, notCQ);
                    await utils_1.UtilFunc.sleep(1000 + parseInt((Math.random() * 500)));
                },
                "private_message": async () => {
                    if (notCQ != true)
                        return void sender.sendPrivateMsg(nChannelId, message, notCQ);
                    let firstClip = true;
                    const pdelay = message.length * 20;
                    const rdelay = parseInt((Math.random() * pdelay));
                    if (firstClip) {
                        firstClip = false;
                        await utils_1.UtilFunc.sleep(500 + rdelay);
                    }
                    else
                        await utils_1.UtilFunc.sleep(1000 + pdelay + rdelay);
                    void sender.sendPrivateMsg(nChannelId, message, notCQ);
                    await utils_1.UtilFunc.sleep(1000 + parseInt((Math.random() * 500)));
                },
            });
            return true;
        },
        async sendVoice(params) {
            const { channelId, voiceFilePath } = params;
            const notCQ = false;
            const nChannelId = parseInt(channelId);
            const mp3 = await Utils_2.AudioCache.transcode2mp3(voiceFilePath);
            const voiceCQ = onebot11_protoclient_1.CQCodeTool.fileRecord(mp3);
            await (0, utils_1.match)((0, Utils_1.chkType)(params), {
                "group_message": async () => {
                    await utils_1.UtilFunc.sleep(1000);
                    void sender.sendGroupMsg(nChannelId, voiceCQ, notCQ);
                },
                "private_message": async () => {
                    await utils_1.UtilFunc.sleep(1000);
                    void sender.sendPrivateMsg(nChannelId, voiceCQ, notCQ);
                },
            });
            return true;
        }
    };
};
exports.QQOfficialActiveSendToolCtor = QQOfficialActiveSendToolCtor;
