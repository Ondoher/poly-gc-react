// References:
// - PKWARE APPNOTE, ZIP central-directory and local-entry structures.

import { inflateRawSync } from 'node:zlib';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

export default class ZipArchiveReader {
    /**
     * @param {Buffer} bytes - Complete ZIP bytes.
     */
    constructor(bytes) {
        if (!Buffer.isBuffer(bytes) || bytes.length < 22) {
            throw configurationError('ER1_ZIP_BYTES_REQUIRED', 'ZIP reader requires complete Buffer bytes.');
        }
        this._bytes = bytes;
        this.entries = readCentralDirectory(bytes);
    }

    /**
     * Read and integrity-check one ZIP entry.
     *
     * @param {string} name - Exact entry path.
     * @returns {Buffer} Uncompressed entry bytes.
     */
    readEntry(name) {
        const entry = this.entries.find((candidate) => candidate.name === name);
        if (!entry) {
            throw configurationError('ER1_ZIP_ENTRY_REQUIRED', `ZIP entry ${name} is missing.`);
        }
        if (this._bytes.readUInt32LE(entry.localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
            throw configurationError('ER1_ZIP_LOCAL_HEADER_INVALID',
                `ZIP entry ${name} has an invalid local header.`);
        }
        const nameLength = this._bytes.readUInt16LE(entry.localHeaderOffset + 26);
        const extraLength = this._bytes.readUInt16LE(entry.localHeaderOffset + 28);
        const dataOffset = entry.localHeaderOffset + 30 + nameLength + extraLength;
        const compressed = this._bytes.subarray(dataOffset, dataOffset + entry.compressedSize);
        let result;
        if (entry.compressionMethod === 0) {
            result = Buffer.from(compressed);
        } else if (entry.compressionMethod === 8) {
            result = inflateRawSync(compressed);
        } else {
            throw configurationError('ER1_ZIP_COMPRESSION_UNSUPPORTED',
                `ZIP entry ${name} uses unsupported compression method ${entry.compressionMethod}.`);
        }
        if (result.length !== entry.uncompressedSize) {
            throw configurationError('ER1_ZIP_ENTRY_SIZE_MISMATCH',
                `ZIP entry ${name} uncompressed size does not match its directory.`);
        }
        if (crc32(result) !== entry.crc32) {
            throw configurationError('ER1_ZIP_ENTRY_CRC_MISMATCH',
                `ZIP entry ${name} failed CRC-32 validation.`);
        }
        return result;
    }
}

function readCentralDirectory(bytes) {
    const eocdOffset = findEndOfCentralDirectory(bytes);
    const entryCount = bytes.readUInt16LE(eocdOffset + 10);
    const centralDirectoryOffset = bytes.readUInt32LE(eocdOffset + 16);
    const entries = [];
    let offset = centralDirectoryOffset;
    for (let index = 0; index < entryCount; index += 1) {
        if (bytes.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
            throw configurationError('ER1_ZIP_CENTRAL_DIRECTORY_INVALID',
                'ZIP central-directory signature is invalid.');
        }
        const compressionMethod = bytes.readUInt16LE(offset + 10);
        const entryCrc32 = bytes.readUInt32LE(offset + 16);
        const compressedSize = bytes.readUInt32LE(offset + 20);
        const uncompressedSize = bytes.readUInt32LE(offset + 24);
        const nameLength = bytes.readUInt16LE(offset + 28);
        const extraLength = bytes.readUInt16LE(offset + 30);
        const commentLength = bytes.readUInt16LE(offset + 32);
        const localHeaderOffset = bytes.readUInt32LE(offset + 42);
        const name = bytes.toString('utf8', offset + 46, offset + 46 + nameLength);
        entries.push(Object.freeze({
            name,
            compressionMethod,
            crc32: entryCrc32,
            compressedSize,
            uncompressedSize,
            localHeaderOffset,
        }));
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return Object.freeze(entries);
}

function findEndOfCentralDirectory(bytes) {
    const minimumOffset = Math.max(0, bytes.length - 65557);
    for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
        if (bytes.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
            return offset;
        }
    }
    throw configurationError('ER1_ZIP_END_DIRECTORY_MISSING',
        'ZIP end-of-central-directory record is missing.');
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}

