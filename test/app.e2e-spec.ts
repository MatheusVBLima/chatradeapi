import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

describe('Chatbot API E2E Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Configure Swagger Documentation (same as main.ts)
    const config = new DocumentBuilder()
      .setTitle('Chatbot RADE API')
      .setDescription('API de chatbot para a plataforma RADE com integração WhatsApp (Z-API) e Google Gemini AI')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('/health (GET) - should return basic health check', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('service', 'chatbot-api');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
        });
    });

    it('/health/detailed (GET) - should return detailed health check', () => {
      return request(app.getHttpServer())
        .get('/health/detailed')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('memory');
          expect(res.body).toHaveProperty('cpu');
          expect(res.body).toHaveProperty('platform');
        });
    });
  });

  describe('Metrics Endpoints', () => {
    it('/metrics/summary (GET) - should return metrics summary', () => {
      return request(app.getHttpServer())
        .get('/metrics/summary')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalRequests');
          expect(res.body).toHaveProperty('totalTokens');
          expect(res.body).toHaveProperty('totalCost');
        });
    });

    it('/metrics/raw (GET) - should return raw metrics', () => {
      return request(app.getHttpServer())
        .get('/metrics/raw')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('metrics');
          expect(res.body).toHaveProperty('count');
          expect(Array.isArray(res.body.metrics)).toBe(true);
        });
    });

    it('/metrics/clear (POST) - should clear metrics', () => {
      return request(app.getHttpServer())
        .post('/metrics/clear')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Metrics cleared successfully');
        });
    });
  });

  describe('Chat Endpoints - Validation', () => {
    it('/chat/test_open (POST) - should reject empty message', () => {
      return request(app.getHttpServer())
        .post('/chat/test_open')
        .send({ message: '' })
        .expect(400);
    });

    it('/chat/test_open (POST) - should reject missing message', () => {
      return request(app.getHttpServer())
        .post('/chat/test_open')
        .send({})
        .expect(400);
    });

    it('/chat/test_closed (POST) - should reject invalid data', () => {
      return request(app.getHttpServer())
        .post('/chat/test_closed')
        .send({ invalidField: 'test' })
        .expect(400);
    });
  });

  describe('Chat Endpoints - Test Mode (Mock Data)', () => {
    it('/chat/test_open (POST) - should process open chat with mock data', () => {
      return request(app.getHttpServer())
        .post('/chat/test_open')
        .send({
          message: 'Olá',
          environment: 'web',
          cpf: '12345678901',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('response');
          expect(res.body).toHaveProperty('success');
          expect(typeof res.body.response).toBe('string');
        });
    }, 30000); // 30s timeout for AI response

    it('/chat/test_closed (POST) - should process closed chat with mock data', () => {
      return request(app.getHttpServer())
        .post('/chat/test_closed')
        .send({
          message: '1',
          environment: 'web',
          state: null,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('response');
          expect(res.body).toHaveProperty('nextState');
        });
    });

    it('/chat/test_hybrid (POST) - should process hybrid chat with mock data', () => {
      return request(app.getHttpServer())
        .post('/chat/test_hybrid')
        .send({
          message: 'Olá',
          environment: 'web',
          state: null,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('response');
          expect(res.body).toHaveProperty('nextState');
          expect(res.body).toHaveProperty('success');
        });
    });

    it('/chat/test_health (POST) - should return health check', () => {
      return request(app.getHttpServer())
        .post('/chat/test_health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'OK');
          expect(res.body).toHaveProperty('mode', 'test');
        });
    });
  });

  describe('Report Endpoints', () => {
    it('/reports/from-cache/:cacheId/:format (GET) - should return 404 for non-existent cache', () => {
      return request(app.getHttpServer())
        .get('/reports/from-cache/non-existent-id/pdf')
        .expect(404);
    });

    it('/reports/from-cache/:cacheId/:format (GET) - should reject invalid format', () => {
      return request(app.getHttpServer())
        .get('/reports/from-cache/some-id/invalid')
        .expect(404); // Route not found for invalid format
    });
  });

  describe('Webhook Endpoints', () => {
    it('/webhook/zapi-health (POST) - should return webhook health', () => {
      return request(app.getHttpServer())
        .post('/webhook/zapi-health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'OK');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('sessions');
        });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits (30 requests per minute)', async () => {
      // Make requests to an endpoint that has rate limiting
      // Note: Health endpoint has @SkipThrottle, so we test metrics instead
      const requests = Array.from({ length: 35 }, (_, i) =>
        request(app.getHttpServer())
          .get('/metrics/summary')
          .then(res => ({ status: res.status, index: i }))
      );

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429 Too Many Requests)
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    }, 15000);
  });

  describe('Swagger Documentation', () => {
    it('/api/docs (GET) - should return Swagger UI HTML', () => {
      return request(app.getHttpServer())
        .get('/api/docs')
        .expect(200)
        .expect('Content-Type', /html/);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', () => {
      return request(app.getHttpServer())
        .get('/non-existent-route')
        .expect(404);
    });

    it('should return proper error format', () => {
      return request(app.getHttpServer())
        .post('/chat/test_open')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('statusCode', 400);
        });
    });
  });
});
