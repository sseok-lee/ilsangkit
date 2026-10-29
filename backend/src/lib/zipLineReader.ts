// zip 안 첫 파일을 줄 단위로 흘려 읽는다. 건축HUB 대용량 파일(최대 3GB)을 메모리에 올리지 않기 위해
// 중앙 디렉터리 기반 스트리밍(yauzl)을 쓴다 — 이 파일들은 data descriptor 를 써서 앞에서부터 읽는 방식으로는 크기를 모른다.

import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import yauzl, { type Entry, type ZipFile } from 'yauzl';

function openZip(path: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: true }, (error, zip) => (error ? reject(error) : resolve(zip)));
  });
}

function firstFileEntry(zip: ZipFile): Promise<Entry> {
  return new Promise((resolve, reject) => {
    zip.on('entry', (entry: Entry) => {
      if (entry.fileName.endsWith('/')) zip.readEntry();
      else resolve(entry);
    });
    zip.on('end', () => reject(new Error('zip 안에 파일이 없다')));
    zip.on('error', reject);
    zip.readEntry();
  });
}

function openEntry(zip: ZipFile, entry: Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream)));
  });
}

export async function* readZipLines(zipPath: string): AsyncGenerator<string> {
  const zip = await openZip(zipPath);
  try {
    const stream = await openEntry(zip, await firstFileEntry(zip));
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of lines) {
      if (line.length > 0) yield line;
    }
  } finally {
    zip.close();
  }
}
