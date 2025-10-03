// Load test environment variables before running tests
process.env.NODE_ENV = 'development';
process.env.PORT = '3001';
process.env.USE_API_DATA = 'false';
process.env.REPORTS_ENABLED = 'true';
process.env.RADE_API_BASE_URL = 'https://api.test.example.com';
process.env.RADE_API_TOKEN = 'test-token-12345';
process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-gemini-key-12345';
process.env.DEFAULT_CHAT_MODE = 'hybrid';
process.env.ZAPI_INSTANCE_ID = 'test-instance-id';
process.env.ZAPI_TOKEN = 'test-zapi-token';
process.env.ZAPI_CLIENT_TOKEN = 'test-client-token';
process.env.ZAPI_BASE_URL = 'https://api.z-api.io';
process.env.CORS_ORIGIN = '*';
