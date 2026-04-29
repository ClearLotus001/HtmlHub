import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;
const PROJECT_RE = /^[a-z0-9-]{1,40}$/;
const ITERATION_RE = /^[A-Za-z0-9._-]{1,40}$/;

export class ListPagesQueryDto {
  @IsOptional()
  @Matches(PROJECT_RE, { message: 'project 仅支持小写字母、数字和短横线，长度 1-40' })
  project?: string;

  @IsOptional()
  @Matches(ITERATION_RE, { message: 'iteration 仅支持字母、数字、点、下划线和短横线，长度 1-40' })
  iteration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class UploadPageQueryDto {
  @IsOptional()
  @Matches(ID_RE, { message: 'id 需为 3-64 位字母、数字、下划线或短横线' })
  id?: string;

  @IsOptional()
  @Matches(PROJECT_RE, { message: 'project 仅支持小写字母、数字和短横线，长度 1-40' })
  project?: string;

  @IsOptional()
  @Matches(ITERATION_RE, { message: 'iteration 仅支持字母、数字、点、下划线和短横线，长度 1-40' })
  iteration?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return undefined;
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 10);
  })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}

/** 批量删除请求体 */
export class BatchDeleteBodyDto {
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9_-]{3,64}$/, { each: true, message: 'id 需为 3-64 位字母、数字、下划线或短横线' })
  ids!: string[];
}
