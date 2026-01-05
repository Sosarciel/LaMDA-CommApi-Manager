import { UtilFunc, match } from "@zwa73/utils";
import { OneBotSender, CQCodeTool } from "@sosraciel-lamda/onebot11-protoclient";
import { FfmpegTool } from "@zwa73/audio-utils";
import { chkType } from "./Utils";
import { SendMessageArg, SendVoiceArg, CommApiSendTool } from "@/src/ChatPlantformInterface";
import { AudioCache, InjectTool } from "@/src/Utils";





/**尝试切片
 * @param text 待切片的回复
 * @param maxLength 每段最大长度
 * @returns 切片完成的回复 null为切片失败
 */
const tryClip = (regex: RegExp, text: string, maxLength: number): string | null =>{
    const clipText = text.slice(0, maxLength);
    let lastIndex = -1;
    let result = null;
    while ((result = regex.exec(clipText))) lastIndex = result.index;
    if (lastIndex != -1 && lastIndex >= maxLength / 2) return text.slice(0, lastIndex + 1);
    return null;
}

/**回复切片
 * @param text 待切片的回复
 * @param maxLength 每段最大长度
 * @returns 切片完成的回复
 */
const clipMessage = (text: string, maxLength: number): string[] =>{
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
        const clipText =
            tryClip(firt, text, maxLength) ??
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
        clipText = InjectTool.markdownFormat(clipText);
        //排除单独的星号
        clipText = clipText.replace(/\n?^\*$\n?/gm, "");
        if (clipText.length >= 1) formatArr.push(clipText);
    }
    return formatArr;
}




/**QQ主动通讯接口
 * @class
 * @param respPort - 端口号
 * @param sendType - 类型 "group_message" 或 "private_message"
 */
export const QQActiveSendToolCtor = (port:number):CommApiSendTool=>{
    const sender = new OneBotSender('127.0.0.1', port);
    return {
        async sendMessage(params:SendMessageArg): Promise<boolean>{
            const { channelId, userId, message, senderId } = params;

            const notCQ = true;
            const nChannelId = parseInt(channelId);
            await match(chkType(params),{
                "group_message":async ()=>{
                    if (notCQ != true)
                        return void sender.sendGroupMsg(nChannelId, message, notCQ);

                    const respArr = clipMessage(message, 80);
                    let firstClip = true;
                    for (const clipMsg of respArr) {
                        const pdelay = clipMsg.length * 100;
                        const rdelay = Math.floor((Math.random() * pdelay));
                        if (firstClip) {
                            firstClip = false;
                            await UtilFunc.sleep(500 + rdelay);
                        } else await UtilFunc.sleep(1000 + pdelay + rdelay);
                        void sender.sendGroupMsg(nChannelId, clipMsg, notCQ);
                    }
                    await UtilFunc.sleep(1000 + Math.floor((Math.random() * 500)));
                },
                "private_message":async ()=>{
                    if (notCQ != true)
                        return void sender.sendPrivateMsg(nChannelId, message, notCQ);

                    const respArr = clipMessage(message, 80);
                    let firstClip = true;
                    for (const clipMsg of respArr) {
                        const pdelay = clipMsg.length * 20;
                        const rdelay = Math.floor((Math.random() * pdelay));
                        if (firstClip) {
                            firstClip = false;
                            await UtilFunc.sleep(500 + rdelay);
                        } else await UtilFunc.sleep(1000 + pdelay + rdelay);
                        void sender.sendPrivateMsg(nChannelId, clipMsg, notCQ);
                    }
                    await UtilFunc.sleep(1000 + Math.floor((Math.random() * 500)));
                }
            });
            return true;
        },

        async sendVoice(params:SendVoiceArg ): Promise<boolean> {
            const { channelId, userId, senderId,voiceFilePath } = params;

            const notCQ = false;
            const nChannelId = parseInt(channelId);
            const fixvoiceFilePath = await AudioCache.acodec2pcms16(voiceFilePath);
            const voiceCQ = CQCodeTool.fileRecord(fixvoiceFilePath);
            await match(chkType(params),{
                "group_message":async ()=>{
                    const duration = await FfmpegTool.getAudioDuration(fixvoiceFilePath);
                    const dur = duration != null
                        ? Math.floor(duration * 1000 + Math.random() * 1000)
                        : 30_000;
                    await UtilFunc.sleep(dur);
                    void sender.sendGroupMsg(nChannelId, voiceCQ, notCQ);
                },
                "private_message":async ()=>{
                    await UtilFunc.sleep(1000);
                    void sender.sendPrivateMsg(nChannelId, voiceCQ, notCQ);
                }
            });
            return true;
        }
    }
}
