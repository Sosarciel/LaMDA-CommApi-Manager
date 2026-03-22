import { UtilFunc, match } from "@zwa73/utils";
import { OneBotSender, CQCodeTool } from "@sosraciel-lamda/onebot11-protoclient";
import { FfmpegTool } from "@zwa73/audio-utils";
import { chkType } from "./Utils";
import { SendMessageArg, SendVoiceArg, CommApiSendTool } from "@/src/ChatPlantformInterface";
import { AudioCache } from "@/src/Utils";
import { TextClipper, TextFormatter } from "@sosraciel-lamda/text-processor";


/**QQ主动通讯接口
 * @class
 * @param respPort - 端口号
 * @param sendType - 类型 "group_message" 或 "private_message"
 */
export const QQActiveSendToolCtor = (port:number):CommApiSendTool=>{
    const sender = OneBotSender.create({host:'127.0.0.1', port});
    return {
        async sendMessage(params:SendMessageArg): Promise<boolean>{
            const { channelId, message } = params;

            const notCQ = true;
            const nChannelId = parseInt(channelId);
            await match(chkType(params),{
                "group_message":async ()=>{
                    if (notCQ != true)
                        return void sender.sendGroupMsg(nChannelId, message, notCQ);

                    const respArr = TextClipper.clipMessage({
                        text:message, maxLength:80
                    }).map(TextFormatter.fixMarkdown);

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

                    const respArr = TextClipper.clipMessage({
                        text:message, maxLength:80
                    }).map(TextFormatter.fixMarkdown);

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
            const { channelId,voiceFilePath } = params;

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
