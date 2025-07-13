import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleService } from './console.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const consoleService = app.get(ConsoleService);
  
  consoleService.start();
}

bootstrap();