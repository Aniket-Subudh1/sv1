import './instrumentation';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

 
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.setGlobalPrefix('api');
app.enableCors({
  origin: (origin, callback) => {

    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://admin.saveful.app',
      'https://saveful.app',
    ];

    // Allow expo dev
    if (origin.startsWith('exp://') || origin.startsWith('http://192.168.')) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
});

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: false,
    whitelist: true
  }));

  app.use((req, res, next) => {
    logger.log(`Request: ${req.method} ${req.url}`, {
      method: req.method,
      path: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    next();
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  logger.log(`Application is running on: http://0.0.0.0:${process.env.PORT ?? 3000}`);
}
bootstrap();