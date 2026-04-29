import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import archiver from 'archiver';
import { PagesService } from './pages.service';
import { config } from '../config';
import { ListPagesQueryDto, UploadPageQueryDto, BatchDeleteBodyDto } from './pages.dto';
import { ManifestOverrides } from './manifest-resolver';

@ApiTags('pages')
@Controller('api')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  /**
   * 健康检查接口
   * 用于检查 API 服务是否正常运行
   */
  @Get('health')
  @ApiOperation({ summary: '健康检查', description: '检查 API 服务是否正常运行' })
  health() {
    return { ok: true, ts: Date.now() };
  }

  /**
   * 获取页面列表
   * @param project - 按项目名称筛选（可选）
   * @param iteration - 按迭代版本筛选（可选）
   * @param q - 搜索关键词，会匹配标题、摘要和标签（可选）
   * @param page - 页码，从 1 开始（可选，默认 1）
   * @param pageSize - 每页数量（可选，默认 20，最大 100）
   */
  @Get('pages')
  @ApiOperation({ summary: '获取页面列表', description: '支持按项目、迭代筛选和关键词搜索，支持分页' })
  @ApiQuery({ name: 'project', required: false, description: '项目名称，用于筛选特定项目的页面' })
  @ApiQuery({ name: 'iteration', required: false, description: '迭代版本，用于筛选特定迭代的页面' })
  @ApiQuery({ name: 'q', required: false, description: '搜索关键词，匹配标题、摘要和标签' })
  @ApiQuery({ name: 'page', required: false, description: '页码（从 1 开始），默认第 1 页' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量（1-100），默认 20 条' })
  list(
    @Query() query: ListPagesQueryDto,
  ) {
    return this.pages.list(query);
  }

  /**
   * 获取项目/迭代树
   * 返回所有项目和对应的迭代列表，用于前端侧栏导航
   */
  @Get('projects')
  @ApiOperation({ summary: '获取项目/迭代树', description: '返回所有项目及其迭代列表，用于前端导航' })
  projects() {
    return this.pages.projectTree();
  }

  /**
   * 获取页面详情
   * @param id - 页面唯一标识符
   */
  @Get('pages/:id')
  @ApiOperation({ summary: '获取页面详情', description: '根据页面 ID 获取完整信息' })
  @ApiParam({ name: 'id', description: '页面唯一标识符（3-64 位字母、数字、下划线或横线）' })
  findOne(@Param('id') id: string) {
    return this.pages.findOne(id);
  }

  /**
   * 上传页面：同时支持 .zip 与 .html
   * 通过 query 参数可覆盖/补充 manifest 字段（尤其适合宽松模式）：
   *   project, iteration, title, author, version, tags(逗号分隔), summary, id
   */
  @Post('pages/upload')
  @ApiOperation({
    summary: '上传页面',
    description: '支持上传 .zip（标准/宽松模式）或 .html 文件。可通过 query 参数覆盖 manifest 字段',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '页面文件（.zip 或 .html）' },
      },
    },
  })
  @ApiQuery({ name: 'project', required: false, description: '项目名称（覆盖/补充 manifest）' })
  @ApiQuery({ name: 'iteration', required: false, description: '迭代版本（覆盖/补充 manifest）' })
  @ApiQuery({ name: 'title', required: false, description: '页面标题（覆盖/补充 manifest）' })
  @ApiQuery({ name: 'author', required: false, description: '作者名称（覆盖/补充 manifest）' })
  @ApiQuery({ name: 'version', required: false, description: '版本号（覆盖/补充 manifest）' })
  @ApiQuery({ name: 'tags', required: false, description: '标签列表，逗号分隔（覆盖/补充 manifest）' })
  @ApiQuery({ name: 'summary', required: false, description: '页面摘要（覆盖/补充 manifest）' })
  @ApiQuery({ name: 'id', required: false, description: '自定义页面 ID（覆盖/补充 manifest）' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const tmp = path.join(os.tmpdir(), 'htmlhub-uploads');
          fs.mkdirSync(tmp, { recursive: true });
          cb(null, tmp);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
          cb(null, `${unique}-${file.originalname}`);
        },
      }),
      limits: {
        // 取 zip 与单 HTML 的上限较大值，具体校验在 service 内
        fileSize: config.upload.maxZipBytes,
      },
      fileFilter: (_req, file, cb) => {
        const ok = /\.(zip|html?)$/i.test(file.originalname);
        if (!ok) {
          return cb(
            new BadRequestException('仅支持 .zip 或 .html 文件'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: UploadPageQueryDto,
  ) {
    if (!file) {
      throw new BadRequestException('未接收到文件，字段名须为 file');
    }

    const overrides: ManifestOverrides = {
      id: query.id,
      title: query.title,
      project: query.project,
      iteration: query.iteration,
      author: query.author,
      version: query.version,
      summary: query.summary,
      tags: query.tags,
    };

    try {
      const isHtml = /\.html?$/i.test(file.originalname);
      const isZip = /\.zip$/i.test(file.originalname);

      let dto;
      if (isZip) {
        dto = await this.pages.ingestZip(
          file.path,
          file.originalname,
          overrides,
        );
      } else if (isHtml) {
        dto = await this.pages.ingestSingleHtml(
          file.path,
          file.originalname,
          overrides,
        );
      } else {
        throw new BadRequestException('不支持的文件类型');
      }
      return dto;
    } finally {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * 下载页面
   * 将页面目录实时打包为 zip 返回
   * @param id - 页面唯一标识符
   */
  @Get('pages/:id/download')
  @ApiOperation({ summary: '下载页面', description: '将页面目录实时打包为 zip 文件返回' })
  @ApiParam({ name: 'id', description: '页面唯一标识符' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { dir, page } = this.pages.getPageDir(id);
    const zipName = `${page.id}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(zipName)}"`,
    );

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err: any) => {
      res.status(500).end(`打包失败：${err.message}`);
    });
    archive.pipe(res);
    archive.directory(dir, false);
    await archive.finalize();
  }

  /**
   * 批量软删除页面
   * 将多个页面移入回收站，在缓冲期内可恢复
   * 同时兼容单个删除（ids 只传一个即可）
   */
  @Delete('pages/batch')
  @ApiOperation({ summary: '批量删除页面', description: '批量软删除页面到回收站，支持单个和批量操作' })
  @ApiBody({ type: BatchDeleteBodyDto })
  batchRemove(@Body() body: BatchDeleteBodyDto) {
    return this.pages.batchSoftDelete(body.ids, 'manual');
  }

  /**
   * 软删除页面
   * 将页面移入回收站，在缓冲期内可恢复
   * @param id - 页面唯一标识符
   */
  @Delete('pages/:id')
  @ApiOperation({ summary: '删除页面', description: '软删除页面到回收站，缓冲期内可通过恢复接口找回' })
  @ApiParam({ name: 'id', description: '页面唯一标识符' })
  remove(@Param('id') id: string) {
    this.pages.softDelete(id, 'manual');
    return { ok: true };
  }

  /**
   * 批量恢复页面
   * 从回收站批量恢复已删除的页面
   * 同时兼容单个恢复（ids 只传一个即可）
   */
  @Put('pages/batch/restore')
  @ApiOperation({ summary: '批量恢复页面', description: '从回收站批量恢复已删除的页面，支持单个和批量操作' })
  @ApiBody({ type: BatchDeleteBodyDto })
  batchRestore(@Body() body: BatchDeleteBodyDto) {
    return this.pages.batchRestore(body.ids);
  }

  /**
   * 恢复页面
   * 从回收站恢复已删除的页面（需在回收站保留期内）
   * @param id - 页面唯一标识符
   */
  @Put('pages/:id/restore')
  @ApiOperation({ summary: '恢复页面', description: '从回收站恢复已删除的页面，需在保留期内操作' })
  @ApiParam({ name: 'id', description: '页面唯一标识符' })
  restore(@Param('id') id: string) {
    return this.pages.restore(id);
  }

  /**
   * 预览回收站中的报告
   * 从回收站物理目录提供静态文件，支持预览已删除的报告内容
   * @param id - 页面唯一标识符
   * @param filepath - 文件相对路径（可选，默认为入口文件）
   */
  @Get('trash/:id/preview')
  @ApiOperation({ summary: '预览回收站报告入口', description: '返回回收站中报告的入口文件，用于 iframe 预览' })
  @ApiParam({ name: 'id', description: '页面唯一标识符' })
  previewTrashEntry(@Param('id') id: string, @Res() res: Response) {
    const { dir, entry } = this.pages.getTrashPageDir(id);
    const filePath = path.resolve(dir, entry);
    // 安全校验：防止路径穿越
    if (!filePath.startsWith(dir)) {
      throw new BadRequestException('非法路径');
    }
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('入口文件不存在');
    }
    return res.sendFile(filePath);
  }

  @Get('trash/:id/preview/*')
  @ApiOperation({ summary: '预览回收站报告资源', description: '返回回收站中报告的子资源文件（CSS/JS/图片等）' })
  @ApiParam({ name: 'id', description: '页面唯一标识符' })
  previewTrashFile(@Param('id') id: string, @Param('*') filepath: string, @Res() res: Response) {
    const { dir } = this.pages.getTrashPageDir(id);
    // 解码 URL 编码的路径
    const decodedPath = decodeURIComponent(filepath || '');
    const filePath = path.resolve(dir, decodedPath);
    // 安全校验：防止路径穿越
    if (!filePath.startsWith(dir)) {
      throw new BadRequestException('非法路径');
    }
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('文件不存在');
    }
    return res.sendFile(filePath);
  }

  /**
   * 回收站列表
   * 列出所有已软删除但未物理清理的页面
   */
  @Get('trash')
  @ApiOperation({ summary: '回收站列表', description: '列出所有已软删除但未物理清理的页面，支持搜索和分页' })
  @ApiQuery({ name: 'q', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'page', required: false, description: '页码（从 1 开始）' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量（1-100）' })
  listTrash(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.pages.listTrash({
      q: q || undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  /**
   * 批量物理删除回收站记录
   * 立即清理多个物理文件，不可恢复
   * 同时兼容单个删除（ids 只传一个即可）
   */
  @Delete('trash/batch')
  @ApiOperation({ summary: '批量物理删除', description: '批量物理删除回收站中的页面，支持单个和批量操作，不可恢复' })
  @ApiBody({ type: BatchDeleteBodyDto })
  batchPurge(@Body() body: BatchDeleteBodyDto) {
    return this.pages.batchPurge(body.ids);
  }

  /**
   * 物理删除单条回收站记录
   * 立即清理物理文件，不可恢复
   */
  @Delete('trash/:id')
  @ApiOperation({ summary: '物理删除', description: '立即物理删除回收站中的指定页面，不可恢复' })
  @ApiParam({ name: 'id', description: '页面唯一标识符' })
  purgeOne(@Param('id') id: string) {
    const freed = this.pages.purge(id);
    return { ok: true, bytes_freed: freed };
  }
}
