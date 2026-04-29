/**
 * 跨平台并行命令执行器
 * 用法: node scripts/parallel.ts "cmd1" "cmd2" ...
 * 所有命令并行执行，任一失败则全部终止
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { platform } from 'node:os';

const commands: string[] = process.argv.slice(2);

if (commands.length === 0) {
  console.error('用法: node scripts/parallel.ts "cmd1" "cmd2" ...');
  process.exit(1);
}

// 颜色代码，用于区分不同进程的输出
const colors: string[] = ['\x1b[36m', '\x1b[33m', '\x1b[32m', '\x1b[35m', '\x1b[34m'];
const reset = '\x1b[0m';

const isWindows: boolean = platform() === 'win32';

const children: ChildProcess[] = commands.map((cmd: string, index: number) => {
  const color: string = colors[index % colors.length]!;
  const label = `[${index}]`;

  const child: ChildProcess = spawn(cmd, {
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    ...(isWindows ? { env: { ...process.env, FORCE_COLOR: '1' } } : {}),
  });

  child.stdout?.on('data', (data: Buffer) => {
    const lines: string[] = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        process.stdout.write(`${color}${label}${reset} ${line}\n`);
      }
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    const lines: string[] = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        process.stderr.write(`${color}${label}${reset} ${line}\n`);
      }
    }
  });

  return child;
});

// 任一进程退出时，终止所有其他进程
let exiting = false;

for (const child of children) {
  child.on('exit', (code: number | null) => {
    if (code !== 0 && !exiting) {
      exiting = true;
      console.error(`\n进程退出，退出码: ${code}，正在终止所有进程...`);
      for (const c of children) {
        c.kill();
      }
      process.exit(code ?? 1);
    }
  });
}

// 处理 Ctrl+C 信号
process.on('SIGINT', () => {
  for (const child of children) {
    child.kill();
  }
  process.exit(0);
});