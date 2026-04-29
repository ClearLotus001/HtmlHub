import { Controller, Get, Post, Put, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CleanupService } from './cleanup.service';
import { CleanupLogsQueryDto, CleanupRunsQueryDto, RunCleanupQueryDto, UpdateCleanupConfigDto } from './cleanup.dto';
import { config } from '../config';

@ApiTags('cleanup')
@Controller('api/cleanup')
export class CleanupController {
  constructor(private readonly cleanup: CleanupService) {}

  /**
   * 查看当前生效的清理策略
   * 返回清理任务的配置信息，包括是否启用、Cron 表达式、保留天数等
   */
  @Get('config')
  @ApiOperation({ summary: '查看清理策略配置', description: '返回当前生效的清理策略配置信息' })
  getConfig() {
    return {
      enabled: config.cleanup.enabled,
      cron: config.cleanup.cron,
      defaultRetainDays: config.cleanup.defaultRetainDays,
      trashRetainDays: config.cleanup.trashRetainDays,
      batchLimit: config.cleanup.batchLimit,
      rules: config.cleanup.rules,
    };
  }

  /**
   * 更新清理策略配置（运行时热更新，不持久化到环境变量）
   */
  @Put('config')
  @ApiOperation({ summary: '更新清理策略配置', description: '运行时热更新清理策略，仅修改传入的字段' })
  updateConfig(@Body() dto: UpdateCleanupConfigDto) {
    if (dto.enabled !== undefined) config.cleanup.enabled = dto.enabled;
    if (dto.cron !== undefined) config.cleanup.cron = dto.cron;
    if (dto.defaultRetainDays !== undefined) config.cleanup.defaultRetainDays = dto.defaultRetainDays;
    if (dto.trashRetainDays !== undefined) config.cleanup.trashRetainDays = dto.trashRetainDays;
    if (dto.batchLimit !== undefined) config.cleanup.batchLimit = dto.batchLimit;
    if (dto.rules !== undefined) config.cleanup.rules = dto.rules;
    return this.getConfig();
  }

  /**
   * 手动触发一次清理
   * @param dryRun - 是否为预演模式（1 或 true 表示仅预览不实际执行）
   */
  @Post('run')
  @ApiOperation({ summary: '手动触发清理', description: '手动触发一次清理任务，支持预演模式' })
  @ApiQuery({ name: 'dryRun', required: false, description: '预演模式（1 或 true 表示仅预览不实际执行）' })
  async run(@Query() query: RunCleanupQueryDto) {
    return this.cleanup.runOnce('manual', query.dryRun ?? false);
  }

  /**
   * 获取最近清理运行摘要
   * @param limit - 返回记录数量限制（1-100）
   */
  @Get('runs')
  @ApiOperation({ summary: '清理运行摘要', description: '获取最近的清理任务运行摘要列表' })
  @ApiQuery({ name: 'limit', required: false, description: '返回记录数量（1-100），默认 20' })
  runs(@Query() query: CleanupRunsQueryDto) {
    return this.cleanup.listRuns(query.limit ?? 20);
  }

  /**
   * 获取清理日志明细
   * @param runId - 按运行 ID 过滤（可选）
   * @param limit - 返回记录数量限制（1-1000）
   */
  @Get('logs')
  @ApiOperation({ summary: '清理日志明细', description: '获取清理任务执行的详细日志记录' })
  @ApiQuery({ name: 'runId', required: false, description: '按运行 ID 过滤日志' })
  @ApiQuery({ name: 'limit', required: false, description: '返回记录数量（1-1000），默认 200' })
  logs(@Query() query: CleanupLogsQueryDto) {
    return this.cleanup.listLogs(query.runId, query.limit ?? 200);
  }
}
