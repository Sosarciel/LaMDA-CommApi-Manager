import path from 'pathe';
import { Worker } from 'worker_threads';
import { Bridge, SLogger } from '@zwa73/utils';
import type { BridgeInterface } from '@zwa73/utils';

import type { ImageWorkerInterface } from './ImageWorkerClient';

/**图像转换 worker 池
 * 常驻单例, 承载 sharp 与 @jsquash/jxl 的转换工作
 *
 * 使用 worker 而非在主线程直接转换的原因:
 * - jxl 解码需patch全局 fetch, 隔离在worker内可避免污染主线程
 * - sharp 与 wasm 装载耗时且占内存, 隔离后不阻塞主线程
 * - 产物直接落盘, 无需经主线程传递图像数据
 */
export class ImageWorkerPool{
    private static worker?:Worker;
    private static bridge?:BridgeInterface<ImageWorkerInterface>;
    /**是否正在主动关闭 用于抑制 terminate 产生的非零退出码告警 */
    private static closing = false;

    /**惰性启动worker并建立桥
     * @returns 桥接口
     */
    private static start(){
        if(ImageWorkerPool.bridge != null) return ImageWorkerPool.bridge;

        const worker = new Worker(path.join(__dirname,'ImageWorkerClient.js'));
        ImageWorkerPool.worker = worker;
        ImageWorkerPool.bridge = Bridge.create<ImageWorkerInterface>({
            needAccept: true,
            acceptedRetry: 0,
            client:{},
            send:(data)=>worker.postMessage(data),
            init:(onData)=>worker.on('message',onData),
        });

        worker.on('error',(e)=>{
            SLogger.warn(`ImageWorkerPool worker错误:`,e);
        });
        worker.on('exit',(code)=>{
            //worker退出后清空句柄, 使下次调用重新启动
            ImageWorkerPool.bridge = undefined;
            ImageWorkerPool.worker = undefined;
            //terminate会以非零码结束, 主动关闭不算异常
            if(code !== 0 && !ImageWorkerPool.closing)
                SLogger.warn(`ImageWorkerPool worker异常退出 code:${code}`);
        });

        return ImageWorkerPool.bridge;
    }

    /**将图像转换为 PNG
     * @param input  - 输入图像路径
     * @param output - 输出 png 路径
     * @returns 是否转换成功
     * @async
     */
    static async convertToPng(input:string, output:string):Promise<boolean>{
        const bridge = ImageWorkerPool.start();
        return await bridge.convertToPng({ input, output });
    }

    /**将图像转换为 WEBP
     * @param input  - 输入图像路径
     * @param output - 输出 webp 路径
     * @returns 是否转换成功
     * @async
     */
    static async convertToWebp(input:string, output:string):Promise<boolean>{
        const bridge = ImageWorkerPool.start();
        return await bridge.convertToWebp({ input, output });
    }

    /**关闭worker 释放资源 */
    static async close(){
        const worker = ImageWorkerPool.worker;
        ImageWorkerPool.bridge = undefined;
        ImageWorkerPool.worker = undefined;
        if(worker == null) return;
        ImageWorkerPool.closing = true;
        try{
            await worker.terminate();
        }finally{
            ImageWorkerPool.closing = false;
        }
    }
}
