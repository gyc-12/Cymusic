import { decode, encode } from 'base-64';
import * as FileSystem from 'expo-file-system/legacy';

import Buffer from './Buffer';
import MusicInfoResponse from './MusicInfoResponse';

const BUFFER_SIZE = 256 * 1024;

const EMPTY = '';
const ID3_TOKEN = 'ID3';
const TITLE_TOKEN = 'TIT2';
const ARTIST_TOKEN = 'TPE1';
const ALBUM_TOKEN = 'TALB';
const GENRE_TOKEN = 'TCON';
const PICTURE_TOKEN = 'APIC';

class MusicInfo {
    static async getMusicInfoAsync(fileUri, options) {
        let loader = new MusicInfoLoader(fileUri, options);
        let result = await loader.loadInfo();
        return result;
    }
}

class MusicInfoLoader {
    constructor(fileUri, options) {
        this.fileUri = fileUri;
        this.expectedFramesNumber = 0;

        this.options = options ? {
            title: options.title ? options.title : true,
            artist: options.artist ? options.artist : true,
            album: options.album ? options.album : true,
            genre: options.genre ? options.genre : false,
            picture: options.picture ? options.picture : false
        } : {
            title: true,
            artist: true,
            album: true,
            genre: false,
            picture: false
        };

        if (this.options.title == true)
            this.expectedFramesNumber++;
        if (this.options.artist == true)
            this.expectedFramesNumber++;
        if (this.options.album == true)
            this.expectedFramesNumber++;
        if (this.options.genre == true)
            this.expectedFramesNumber++;
        if (this.options.picture == true)
            this.expectedFramesNumber++;

        this.buffer = new Buffer();
        this.filePosition = 0;
        this.dataSize = 0;
        this.frames = new Object();
        this.version = 0;
        this.finished = false;
    }

    async loadFileToBuffer() {
        let data = await FileSystem.readAsStringAsync(this.fileUri, {
            encoding: FileSystem.EncodingType.Base64,
            position: this.filePosition,
            length: BUFFER_SIZE
        });
        this.buffer.setData(Uint8Array.from(decode(data), c => c.charCodeAt(0)));
        this.filePosition += BUFFER_SIZE;
    }

    async loadInfo() {
        let info = await FileSystem.getInfoAsync(this.fileUri);
        this.dataSize = info.size;
        try {
            await this.process();

            let result = new MusicInfoResponse();
            if (this.options.title && this.frames[TITLE_TOKEN])
                result.title = this.frames[TITLE_TOKEN];
            if (this.options.artist && this.frames[ARTIST_TOKEN])
                result.artist = this.frames[ARTIST_TOKEN];
            if (this.options.album && this.frames[ALBUM_TOKEN])
                result.album = this.frames[ALBUM_TOKEN];
            if (this.options.genre && this.frames[GENRE_TOKEN])
                result.genre = this.frames[GENRE_TOKEN];
            if (this.options.picture && this.frames[PICTURE_TOKEN])
                result.picture = this.frames[PICTURE_TOKEN];
            return result;

        } catch (e) {
            if (e instanceof InvalidFileException)
                return null;
            else
                throw e;
        }
    }

    async process() {
        await this.processHeader();
        while (!this.finished)
            await this.processFrame();
    }

    async skip(length) {
        let remaining = length;
        while (remaining > 0) {
            if (this.buffer.finished()) {
                if (this.filePosition >= this.dataSize) {
                    this.finished = true;
                    break;
                }
                this.filePosition += remaining;
                await this.loadFileToBuffer();
                remaining = 0;
            } else
                remaining -= this.buffer.move(remaining);
        }
    }

    async read(length) {
        let chunk = [];
        for (let i = 0; i < length; i++) {
            if (this.buffer.finished()) {
                if (this.filePosition >= this.dataSize) {
                    this.finished = true;
                    break;
                }
                await this.loadFileToBuffer();
            }
            chunk.push(this.buffer.getByte());
        }
        return chunk;
    }

    async readUntilEnd() {
        let byte = 0;
        let chunk = [];
        do {
            if (this.buffer.finished()) {
                if (this.filePosition >= this.dataSize) {
                    this.finished = true;
                    break;
                }
                await this.loadFileToBuffer();
            }
            byte = this.buffer.getByte();
            chunk.push(byte);
        } while (byte != 0);
        return chunk;
    }

    async processHeader() {
        let chunk = await this.read(3);
        let token = this.bytesToString(chunk);
        if (token !== ID3_TOKEN)
            throw new InvalidFileException();

        chunk = await this.read(2);
        this.version = this.bytesToInt([chunk[0]]);

        await this.skip(1);

        chunk = await this.read(4);
        let size = 0;
        for (let i = 0; i < chunk.length; i++) {
            size |= chunk[chunk.length - i - 1] << i * 7;
        }
        this.dataSize = size;
    }

    async processFrame() {
        let chunk = await this.read(4);
        let frameID = this.bytesToString(chunk);

        if (frameID === EMPTY)
            this.finished = true;
        else {
            chunk = await this.read(4);
            let frameSize = this.bytesToSize(chunk);

            await this.skip(2);
            switch (frameID) {
                case TITLE_TOKEN:
                    if (this.options.title)
                        await this.processTextFrame(frameID, frameSize);
                    else
                        await this.skip(frameSize);
                    break;
                case ARTIST_TOKEN:
                    if (this.options.artist)
                        await this.processTextFrame(frameID, frameSize);
                    else
                        await this.skip(frameSize);
                    break;
                case ALBUM_TOKEN:
                    if (this.options.album)
                        await this.processTextFrame(frameID, frameSize);
                    else
                        await this.skip(frameSize);
                    break;
                case GENRE_TOKEN:
                    if (this.options.genre)
                        await this.processTextFrame(frameID, frameSize);
                    else
                        await this.skip(frameSize);
                    break;
                case PICTURE_TOKEN:
                    if (this.options.picture)
                        await this.processPictureFrame(frameSize);
                    else
                        await this.skip(frameSize);
                    break;
                default:
                    await this.skip(frameSize);
                    break;
            }
            if (Object.keys(this.frames).length == this.expectedFramesNumber)
                this.finished = true;
        }
    }
    bytesToString(bytes, encoding = 'utf-8') {
        return this.decodeBytes(bytes, encoding);
    }
    async processTextFrame(frameID, frameSize) {
        // 读取编码字节
        const encodingByte = await this.read(1);
        // console.log(`处理帧 ${frameID}，编码字节: 0x${encodingByte[0].toString(16)}`);

        let encoding;
        switch (encodingByte[0]) {
            case 0x00:
                encoding = 'iso-8859-1';
                break;
            case 0x01:
                encoding = 'utf-16';
                break;
            case 0x02:
                encoding = 'utf-16be';
                break;
            case 0x03:
                encoding = 'utf-8';
                break;
            default:
                encoding = 'iso-8859-1';
            // console.warn(`未知的编码字节: 0x${encodingByte[0].toString(16)}，使用 'iso-8859-1'`);
        }

        let remaining = frameSize - 1;
        let chunk = await this.read(remaining);
        // console.log(`帧 ${frameID} 的原始数据:`, chunk.map(byte => byte.toString(16)).join(' '));

        let value = this.decodeBytes(chunk, encoding);
        // console.log(`帧 ${frameID} 解码后的值:`, value);

        // 去除值两端的空格
        this.frames[frameID] = value.trim();
    }
    decodeBytes(bytes, encoding) {
        let decodedString;
        switch (encoding) {
            case 'iso-8859-1':
                decodedString = String.fromCharCode.apply(null, bytes);
                break;
            case 'utf-8':
                decodedString = this.decodeUTF8(bytes);
                break;
            case 'utf-16':
                decodedString = this.decodeUTF16(bytes);
                break;
            case 'utf-16be':
                decodedString = this.decodeUTF16BE(bytes);
                break;
            default:
                decodedString = String.fromCharCode.apply(null, bytes);
        }
        // 过滤掉所有不可见字符保留可见的 ASCII 字符、中文字符、顿号和逗号
        return decodedString.replace(/[^\x20-\x7E\u4E00-\u9FFF、，]/g, '');
    }
    decodeUTF8(bytes) {
        let result = '';
        let i = 0;
        while (i < bytes.length) {
            let c = bytes[i++];
            if (c > 127) {
                if (c > 191 && c < 224) {
                    if (i >= bytes.length) {
                        // console.warn('UTF-8 解码: 不完整的 2 字节序列');
                        break;
                    }
                    c = ((c & 31) << 6) | (bytes[i++] & 63);
                } else if (c > 223 && c < 240) {
                    if (i + 1 >= bytes.length) {
                        // console.warn('UTF-8 解码: 不完整的 3 字节序列');
                        break;
                    }
                    c = ((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
                } else if (c > 239 && c < 248) {
                    if (i + 2 >= bytes.length) {
                        // console.warn('UTF-8 解码: 不完整的 4 字节序列');
                        break;
                    }
                    c = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
                } else {
                    // console.warn(`UTF-8 解码: 未知的多字节起始 0x${c.toString(16)} 在索引 ${i - 1}`);
                    continue; // 跳过无效字节
                }
            }
            if (c <= 0xffff) {
                result += String.fromCharCode(c);
            } else if (c <= 0x10ffff) {
                c -= 0x10000;
                result += String.fromCharCode((c >> 10) | 0xd800);
                result += String.fromCharCode((c & 0x3ff) | 0xdc00);
            } else {
                // console.warn(`UTF-8 解码: 码点 0x${c.toString(16)} 超出 UTF-16 范围`);
                continue; // 跳过超出范围的码点
            }
        }
        return result;
    }

    decodeUTF16(bytes) {
        // 检查字节顺序标记 (BOM)
        if (bytes.length >= 2) {
            if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
                // 小端序
                return this.decodeUTF16LE(bytes.slice(2));
            } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
                // 大端序
                return this.decodeUTF16BE(bytes.slice(2));
            }
        }
        // 如果没有 BOM，默认使用小端序
        return this.decodeUTF16LE(bytes);
    }

    decodeUTF16LE(bytes) {
        let result = '';
        for (let i = 0; i < bytes.length; i += 2) {
            result += String.fromCharCode(bytes[i] | bytes[i + 1] << 8);
        }
        return result;
    }

    decodeUTF16BE(bytes) {
        let result = '';
        for (let i = 0; i < bytes.length; i += 2) {
            result += String.fromCharCode(bytes[i] << 8 | bytes[i + 1]);
        }
        return result;
    }



    async processPictureFrame(frameSize) {
        await this.skip(1);
        let remaining = frameSize - 1;

        let chunk = await this.readUntilEnd();
        remaining -= chunk.length;
        let mimeType = this.bytesToString(chunk);

        await this.skip(1);
        remaining -= 1;

        chunk = await this.readUntilEnd();
        remaining -= chunk.length;
        let description = this.bytesToString(chunk);

        let pictureData = await this.read(remaining);
        this.frames[PICTURE_TOKEN] = {
            description: description,
            pictureData: 'data:' + mimeType + ';base64,' + this.bytesToBase64(pictureData)
        };
    }

    bytesToInt(bytes) {
        let a = 0;
        for (let i = 0; i < bytes.length; i++)
            a |= bytes[bytes.length - i - 1] << i * 8;
        return a;
    }

    bytesToSize(bytes) {
        if (this.version == 3)
            return this.bytesToInt(bytes);
        else {
            let a = 0;
            for (let i = 0; i < bytes.length; i++)
                a |= bytes[bytes.length - i - 1] << i * 7;
            return a;
        }
    }

    bytesToBase64(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i++)
            s += String.fromCharCode(bytes[i]);
        return encode(s);
    }
}

class InvalidFileException extends Error {
    constructor() {
        super();
        this.name = 'InvalidFileException';
        this.message = 'Invalid file format.';
    }
}

export default MusicInfo;