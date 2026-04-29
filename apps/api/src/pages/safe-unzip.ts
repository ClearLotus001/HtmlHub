import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yauzl from 'yauzl';
import { config } from '../config';

const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_REGULAR_FILE = 0o100000;
const UNIX_DIRECTORY = 0o040000;
const UNIX_SYMLINK = 0o120000;

// 解压结果
export interface ExtractResult {
  // 解压后总字节数
  totalBytes: number;
  // 解压后文件数
  fileCount: number;
  // manifest.json 内容（未解析）
  manifestJson: string | null;
}

// 判断路径是否安全（禁止 ..、绝对路径、反斜杠盘符）
function isSafeRelPath(p: string): boolean {
  if (!p) return false;
  if (p.includes('\0')) return false;
  if (/^[a-zA-Z]:/.test(p)) return false;
  if (path.isAbsolute(p) || path.win32.isAbsolute(p) || path.posix.isAbsolute(p)) return false;
  // 规范化后不能以 .. 开头，且不能包含空段
  const normalized = path.posix.normalize(p.replace(/\\/g, '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('/')) return false;
  if (normalized.startsWith('..') || normalized.includes('/../')) return false;
  // 禁止 Windows 盘符
  if (/^[a-zA-Z]:/.test(normalized)) return false;
  return true;
}

function assertSafeEntryType(entry: yauzl.Entry): void {
  const mode = (entry.externalFileAttributes >>> 16) & 0o777777;
  if (!mode) return;

  const type = mode & UNIX_FILE_TYPE_MASK;
  if (type === UNIX_SYMLINK) {
    throw new Error(`拒绝解压符号链接：${entry.fileName}`);
  }
  if (type && type !== UNIX_REGULAR_FILE && type !== UNIX_DIRECTORY) {
    throw new Error(`拒绝解压特殊文件：${entry.fileName}`);
  }
}

/**
 * 安全地将 zip 解压到指定目录。
 * 同时执行以下防护：
 *  - 路径穿越检查（防 Zip Slip）
 *  - 文件数量上限
 *  - 解压后总大小上限
 *  - 单文件大小上限
 *
 * @param zipPath  zip 文件路径
 * @param destDir  目标目录（函数会确保其存在且为空）
 */
export function safeExtractZip(
  zipPath: string,
  destDir: string,
): Promise<ExtractResult> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err || new Error('无法打开 zip'));
        return;
      }

      // 确保目标目录存在
      fs.mkdirSync(destDir, { recursive: true });

      let totalBytes = 0;
      let fileCount = 0;
      let manifestJson: string | null = null;
      let aborted = false;

      const abort = (msg: string) => {
        if (aborted) return;
        aborted = true;
        zipfile.close();
        reject(new Error(msg));
      };

      zipfile.on('error', (e) => abort(`zip 读取错误：${e.message}`));
      zipfile.on('end', () => {
        if (!aborted) resolve({ totalBytes, fileCount, manifestJson });
      });

      zipfile.readEntry();
      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (aborted) return;

        const rawName = entry.fileName;
        try {
          assertSafeEntryType(entry);
        } catch (e) {
          return abort(e instanceof Error ? e.message : `非法 zip 条目：${rawName}`);
        }

        // 目录项直接建目录
        if (/\/$/.test(rawName)) {
          if (!isSafeRelPath(rawName)) {
            return abort(`非法目录路径：${rawName}`);
          }
          const dirAbs = path.join(destDir, rawName);
          fs.mkdirSync(dirAbs, { recursive: true });
          zipfile.readEntry();
          return;
        }

        // 校验文件路径
        if (!isSafeRelPath(rawName)) {
          return abort(`非法文件路径：${rawName}`);
        }

        // 文件数限制
        fileCount++;
        if (fileCount > config.upload.maxFileCount) {
          return abort(
            `zip 内文件数超过上限 ${config.upload.maxFileCount}`,
          );
        }

        // 单文件大小限制（未压缩）
        if (entry.uncompressedSize > config.upload.maxSingleFileBytes) {
          return abort(
            `文件 ${rawName} 单体积超过上限 ${config.upload.maxSingleFileBytes} 字节`,
          );
        }

        // 总体积限制
        totalBytes += entry.uncompressedSize;
        if (totalBytes > config.upload.maxExtractedBytes) {
          return abort(
            `解压后总体积超过上限 ${config.upload.maxExtractedBytes} 字节`,
          );
        }

        // 写出文件
        const absPath = path.join(destDir, rawName);
        // 再次做目录防穿越检查
        const resolved = path.resolve(absPath);
        const rootResolved = path.resolve(destDir);
        if (
          !resolved.startsWith(rootResolved + path.sep) &&
          resolved !== rootResolved
        ) {
          return abort(`路径穿越：${rawName}`);
        }

        fs.mkdirSync(path.dirname(absPath), { recursive: true });

        zipfile.openReadStream(entry, (e, readStream) => {
          if (e || !readStream) return abort(`解压失败：${rawName}`);

          // 若是 manifest.json（顶层）则顺带缓存
          const isManifest =
            rawName === 'manifest.json' || rawName === './manifest.json';

          if (isManifest) {
            const chunks: Buffer[] = [];
            readStream.on('data', (c) => chunks.push(c));
            readStream.on('end', () => {
              manifestJson = Buffer.concat(chunks).toString('utf-8');
              // 同时写到磁盘
              fs.writeFileSync(absPath, Buffer.concat(chunks));
              zipfile.readEntry();
            });
            readStream.on('error', (err2) =>
              abort(`读取 manifest 失败：${err2.message}`),
            );
            return;
          }

          const ws = fs.createWriteStream(absPath);
          readStream.pipe(ws);
          ws.on('close', () => zipfile.readEntry());
          ws.on('error', (err2) =>
            abort(`写入失败 ${rawName}：${err2.message}`),
          );
        });
      });
    });
  });
}
