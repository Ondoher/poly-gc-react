// References:
// - tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity, accepted Step 032 PNG parity requirement.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.5 renderer-port requirement.

import { writeFile } from 'node:fs/promises';
import zlib from 'node:zlib';

export async function writePng(filePath, width, height, pixels) {
    const signature = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const header = Buffer.alloc(13);
    const rows = [];

    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;

    for (let y = 0; y < height; y += 1) {
        const rowStart = y * width * 4;
        const rowEnd = rowStart + width * 4;
        rows.push(Buffer.from([0]), pixels.subarray(rowStart, rowEnd));
    }

    const imageData = zlib.deflateSync(Buffer.concat(rows), { level: 9 });
    const png = Buffer.concat([
        signature,
        pngChunk('IHDR', header),
        pngChunk('IDAT', imageData),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);

    await writeFile(filePath, png);
}

function makeCrcTable() {
    const table = new Uint32Array(256);

    for (let n = 0; n < 256; n += 1) {
        let c = n;

        for (let k = 0; k < 8; k += 1) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }

        table[n] = c >>> 0;
    }

    return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffers) {
    let crc = 0xffffffff;

    for (const buffer of buffers) {
        for (const byte of buffer) {
            crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        }
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const lengthBuffer = Buffer.alloc(4);
    const crcBuffer = Buffer.alloc(4);

    lengthBuffer.writeUInt32BE(data.length, 0);
    crcBuffer.writeUInt32BE(crc32([typeBuffer, data]), 0);

    return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}
