import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppMockModule } from './app-mock.module';
import { AppApiModule } from './app-api.module';

async function bootstrap() {
  // Determine which module to use based on environment
  const useApiData = process.env.USE_API_DATA === 'true';
  const moduleToUse = useApiData ? AppApiModule : AppModule; // AppModule is the default (current mixed setup)
  
  console.log(`🚀 Starting application with ${useApiData ? 'REAL API DATA' : 'MOCK DATA'}`);
  
  const app = await NestFactory.create(moduleToUse);

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

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
