import { SendBaseArg } from "@/src/ChatPlantformInterface";
import { MediaCache } from "@/src/Utils";
import path from "pathe";


/**OB11 图片 CQ 码可直接发送的扩展名
 * OB11 规范未定义图片格式白名单, 实际支持范围由协议端决定且变动频繁
 * 此处只列入各协议端普遍支持的常见格式, 其余一律转 png 兜底
 */
const SUPPORTED_IMG_EXT:readonly string[] = ['.jpg', '.jpeg', '.png', '.gif'];

export const chkType = (opt:SendBaseArg)=>{
    if(opt.userId==opt.channelId)
        return "private_message" as const;
    return "group_message" as const;
}

/**确认可用于发送的图片路径
 * 支持列表内直接使用原文件, 其余转 png (避免同格式平转)
 * @param imageFilePath - 输入图片路径
 * @returns 实际发送用的图片路径
 * @async
 */
export const fixImagePath = async (imageFilePath:string)=>{
    const ext = path.extname(imageFilePath).toLowerCase();
    return SUPPORTED_IMG_EXT.includes(ext)
        ? imageFilePath
        : await MediaCache.transcode2png(imageFilePath);
}
