import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return value as boolean;
}

export class RunCleanupQueryDto {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  dryRun?: boolean;
}

export class CleanupRunsQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CleanupLogsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  runId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

// 差异化规则中的匹配条件
class RuleMatchDto {
  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}

// 单条差异化保留规则
class RetentionRuleDto {
  @ValidateNested()
  @Type(() => RuleMatchDto)
  match!: RuleMatchDto;

  @IsInt()
  @Min(1)
  @Max(36500)
  retainDays!: number;
}

// 更新清理策略配置
export class UpdateCleanupConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cron?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36500)
  defaultRetainDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  trashRetainDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  batchLimit?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RetentionRuleDto)
  rules?: RetentionRuleDto[];
}
