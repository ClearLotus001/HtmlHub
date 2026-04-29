import { Module } from '@nestjs/common';
import { CleanupController } from './cleanup.controller';
import { CleanupService } from './cleanup.service';
import { PagesModule } from '../pages/pages.module';

@Module({
  imports: [PagesModule],
  controllers: [CleanupController],
  providers: [CleanupService],
  exports: [CleanupService],
})
export class CleanupModule {}
