"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QQActiveSendToolCtor = void 0;
const utils_1 = require("@zwa73/utils");
const onebot11_protoclient_1 = require("@sosraciel-lamda/onebot11-protoclient");
const audio_utils_1 = require("@zwa73/audio-utils");
const Utils_1 = require("./Utils");
const Utils_2 = require("../../Utils");
/**尝试切片
 * @param text 待切片的回复
 * @param maxLength 每段最大长度
 * @returns 切片完成的回复 null为切片失败
 */
const tryClip = (regex, text, maxLength) => {
    const clipText = text.slice(0, maxLength);
    let lastIndex = -1;
    let result = null;
    while ((result = regex.exec(clipText)))
        lastIndex = result.index;
    if (lastIndex != -1 && lastIndex >= maxLength / 2)
        return text.slice(0, lastIndex + 1);
    return null;
};
/**回复切片
 * @param text 待切片的回复
 * @param maxLength 每段最大长度
 * @returns 切片完成的回复
 */
const clipMessage = (text, maxLength) => {
    //首选
    const firt = /[:：。；？！.;?!\n…~]/g;
    //备选
    const secd = /[，,\s]/g;
    //末尾备选
    const lastSecd = new RegExp(`${secd.source}$`);
    const fistSecd = new RegExp(`^${secd.source}`);
    const outArr = [];
    //分段
    while (text.length > maxLength) {
        const clipText = tryClip(firt, text, maxLength) ??
            tryClip(secd, text, maxLength) ??
            text.slice(0, maxLength);
        outArr.push(clipText);
        //裁剪原始字符串
        text = text.slice(clipText.length);
    }
    outArr.push(text);
    //修正格式，可能增加长度
    const formatArr = [];
    for (let clipText of outArr) {
        //无效备选
        clipText = clipText.replace(lastSecd, "");
        clipText = clipText.replace(fistSecd, "");
        //接收格式化
        clipText = Utils_2.InjectTool.markdownFormat(clipText);
        //排除单独的星号
        clipText = clipText.replace(/\n?^\*$\n?/gm, "");
        if (clipText.length >= 1)
            formatArr.push(clipText);
    }
    return formatArr;
};
/**QQ主动通讯接口
 * @class
 * @param respPort - 端口号
 * @param sendType - 类型 "group_message" 或 "private_message"
 */
const QQActiveSendToolCtor = (port) => {
    const sender = new onebot11_protoclient_1.OneBotSender('127.0.0.1', port);
    return {
        async sendMessage(params) {
            const { channelId, userId, message, senderId } = params;
            const notCQ = true;
            const nChannelId = parseInt(channelId);
            await (0, utils_1.match)((0, Utils_1.chkType)(params), {
                "group_message": async () => {
                    if (notCQ != true)
                        return void sender.sendGroupMsg(nChannelId, message, notCQ);
                    const respArr = clipMessage(message, 80);
                    let firstClip = true;
                    for (const clipMsg of respArr) {
                        const pdelay = clipMsg.length * 100;
                        const rdelay = Math.floor((Math.random() * pdelay));
                        if (firstClip) {
                            firstClip = false;
                            await utils_1.UtilFunc.sleep(500 + rdelay);
                        }
                        else
                            await utils_1.UtilFunc.sleep(1000 + pdelay + rdelay);
                        void sender.sendGroupMsg(nChannelId, clipMsg, notCQ);
                    }
                    await utils_1.UtilFunc.sleep(1000 + Math.floor((Math.random() * 500)));
                },
                "private_message": async () => {
                    if (notCQ != true)
                        return void sender.sendPrivateMsg(nChannelId, message, notCQ);
                    const respArr = clipMessage(message, 80);
                    let firstClip = true;
                    for (const clipMsg of respArr) {
                        const pdelay = clipMsg.length * 20;
                        const rdelay = Math.floor((Math.random() * pdelay));
                        if (firstClip) {
                            firstClip = false;
                            await utils_1.UtilFunc.sleep(500 + rdelay);
                        }
                        else
                            await utils_1.UtilFunc.sleep(1000 + pdelay + rdelay);
                        void sender.sendPrivateMsg(nChannelId, clipMsg, notCQ);
                    }
                    await utils_1.UtilFunc.sleep(1000 + Math.floor((Math.random() * 500)));
                }
            });
            return true;
        },
        async sendVoice(params) {
            const { channelId, userId, senderId, voiceFilePath } = params;
            const notCQ = false;
            const nChannelId = parseInt(channelId);
            const fixvoiceFilePath = await Utils_2.AudioCache.acodec2pcms16(voiceFilePath);
            const voiceCQ = onebot11_protoclient_1.CQCodeTool.fileRecord(fixvoiceFilePath);
            await (0, utils_1.match)((0, Utils_1.chkType)(params), {
                "group_message": async () => {
                    const duration = await audio_utils_1.FfmpegTool.getAudioDuration(fixvoiceFilePath);
                    const dur = duration != null
                        ? Math.floor(duration * 1000 + Math.random() * 1000)
                        : 30_000;
                    await utils_1.UtilFunc.sleep(dur);
                    void sender.sendGroupMsg(nChannelId, voiceCQ, notCQ);
                },
                "private_message": async () => {
                    await utils_1.UtilFunc.sleep(1000);
                    void sender.sendPrivateMsg(nChannelId, voiceCQ, notCQ);
                }
            });
            return true;
        }
    };
};
exports.QQActiveSendToolCtor = QQActiveSendToolCtor;
