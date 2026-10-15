import { SendMessageArg, CommApiSendTool, SendVoiceArg, SendImageArg } from "@/src/ChatPlantformInterface";
import { CQCodeTool, OneBotSender } from "@sosraciel-lamda/onebot11-protoclient";
import { chkType, fixImagePath } from "./Utils";
import { match, sleep, SLogger, UtilFT } from "@zwa73/utils";
import { MediaCache } from "@/src/Utils";
import fs from 'fs';




export const KookActiveSendToolCtor = (port:number):CommApiSendTool=>{
    const sender = OneBotSender.create({host:'127.0.0.1', port});

    return {
        async sendMessage(params:SendMessageArg): Promise<boolean> {
            const { channelId, message } = params;

            const notCQ = true;
            const nChannelId = parseInt(channelId);
            const fixmessage = message.replace(/^\*(.+)\*$/gm,'**`*$1*`**');
            await match(chkType(params),{
                "group_message":async ()=>{
                    await sleep(500 + Math.floor( Math.random() * 500));
                    void sender.sendGroupMsg(nChannelId, fixmessage, notCQ);
                },
                "private_message":async ()=>{
                    await sleep(500 + Math.floor( Math.random() * 500));
                    void sender.sendPrivateMsg(nChannelId, fixmessage, notCQ);
                }
            });
            return true;
        },
        async sendVoice(params:SendVoiceArg): Promise<boolean> {
            const { channelId, voiceFilePath } = params;


            const notCQ = false;
            if(!await UtilFT.pathExists(voiceFilePath)){
                SLogger.warn(`ActiveSendTool.sendVoice 错误 voiceFilePath 不存在: ${voiceFilePath}`);
                return false;
            }
            const wavpath = await MediaCache.acodec2pcms16(voiceFilePath);
            const data = await fs.promises.readFile(wavpath);
            const base64 = data.toString('base64');
            const voiceCQ = CQCodeTool.base64Record(base64);
            const nChannelId = parseInt(channelId);
            await match(chkType(params),{
                "group_message":async ()=>{
                    await sleep(500 + Math.floor( Math.random() * 500));
                    void sender.sendGroupMsg(nChannelId, voiceCQ, notCQ);
                },
                "private_message":async()=>{
                    await sleep(500 + Math.floor( Math.random() * 500));
                    void sender.sendPrivateMsg(nChannelId, voiceCQ, notCQ);
                },
            })
            return true;
        },
        async sendImage(params:SendImageArg): Promise<boolean> {
            const { channelId, imageFilePath } = params;

            const notCQ = false;
            // 支持列表内直发原文件, 其余转 png
            const pngpath = await fixImagePath(imageFilePath);
            const imageCQ = CQCodeTool.fileImage(pngpath);
            const nChannelId = parseInt(channelId);
            await match(chkType(params),{
                "group_message":async ()=>{
                    await sleep(500 + Math.floor( Math.random() * 500));
                    void sender.sendGroupMsg(nChannelId, imageCQ, notCQ);
                },
                "private_message":async()=>{
                    await sleep(500 + Math.floor( Math.random() * 500));
                    void sender.sendPrivateMsg(nChannelId, imageCQ, notCQ);
                },
            })
            return true;
        }
    }
}