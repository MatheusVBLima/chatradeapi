import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppMockModule } from './app-mock.module';
import { AppApiModule } from './app-api.module';
import { AllExceptionsFilter } from './infrastructure/filters';

async function bootstrap() {
  // Determine which module to use based on environment
  const useApiData = process.env.USE_API_DATA === 'true';
  const moduleToUse = useApiData ? AppApiModule : AppModule; // AppModule is the default (current mixed setup)

  console.log(`🚀 Starting application with ${useApiData ? 'REAL API DATA' : 'MOCK DATA'}`);

  const app = await NestFactory.create(moduleToUse);

  // Enable Helmet for security headers
  app.use(helmet());

  // Enable global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Allow implicit type conversion
      },
    }),
  );

  // Configure CORS to allow front-end access
  const corsOrigin = process.env.CORS_ORIGIN;
  let corsOrigins;
  
  if (corsOrigin === '*') {
    // Allow all origins
    corsOrigins = true;
  } else if (corsOrigin) {
    // Split comma-separated origins
    corsOrigins = corsOrigin.split(',').map(origin => origin.trim());
  } else {
    // Default origins
    corsOrigins = [
      'http://localhost:3000', // Next.js dev server
      'http://localhost:3001', // API localhost
      /^https:\/\/.*\.vercel\.app$/, // All Vercel deployments
      /^https:\/\/.*\.render\.com$/, // Render deployments
    ];
  }

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Configure Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Chatbot RADE API')
    .setDescription('API de chatbot para a plataforma RADE com integração WhatsApp (Z-API) e Google Gemini AI')
    .setVersion('1.0')
    .addTag('chat', 'Endpoints de chat (open, closed, hybrid)')
    .addTag('health', 'Health checks e status da API')
    .addTag('webhook', 'Webhooks para integração WhatsApp (Z-API)')
    .addTag('report', 'Geração de relatórios (PDF, CSV, TXT)')
    .addTag('simulation', 'Endpoints de simulação para testes')
    .addTag('metrics', 'Métricas e analytics')
    .addServer('http://localhost:3001', 'Desenvolvimento Local')
    .addServer('https://api.stg.radeapp.com', 'Staging')
    .addServer('https://api.radeapp.com', 'Produção')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Chatbot RADE API - Documentação',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`📚 Swagger documentation available at: ${await app.getUrl()}/api/docs`);
}
bootstrap();
