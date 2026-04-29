import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // 允许内网环境下前端直连，生产统一走 Nginx 反代
    cors: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  // 配置 Swagger 文档
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HtmlHub API 文档')
    .setDescription('HTML 静态页面管理系统 API 接口文档')
    .setVersion('1.0')
    .addTag('pages', '页面管理相关接口')
    .addTag('cleanup', '清理管理相关接口')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
    },
    customSiteTitle: 'HtmlHub API 文档',
  });

  // 全局前缀由每个 Controller 自行带 /api，不在此统一
  await app.listen(config.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`HtmlHub API listening on http://0.0.0.0:${config.port}`);
  logger.log(`API 文档地址: http://0.0.0.0:${config.port}/api-docs`);
  logger.log(`Data dir: ${config.dataDir}`);
}

bootstrap();
