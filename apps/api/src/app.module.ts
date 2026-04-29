﻿import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database.module';
import { PagesModule } from './pages/pages.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { config } from './config';

@Module({
  imports: [
    // 定时任务根模块（CleanupService 的 @Cron 依赖此注册）
    ScheduleModule.forRoot(),
    DatabaseModule,
    PagesModule,
    CleanupModule,
    // 静态托管 reports 目录，通过 /reports/** 访问
    // 生产环境建议交给 Nginx 托管，这里便于开发模式直接访问
    ServeStaticModule.forRoot({
      rootPath: config.reportsDir,
      serveRoot: '/reports',
      serveStaticOptions: {
        index: false,
        redirect: false,
        // 防止被 HTML 嗅探为其他类型
        setHeaders: (res) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Referrer-Policy', 'no-referrer');
        },
      },
    }),
  ],
})
export class AppModule {}
