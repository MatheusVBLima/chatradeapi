import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ProcessOpenChatMessageUseCase } from '../../application/use-cases/process-open-chat-message.use-case';
import { ProcessClosedChatMessageUseCase } from '../../application/use-cases/process-closed-chat-message.use-case';
import { ProcessApiChatMessageUseCase } from '../../application/use-cases/process-api-chat-message.use-case';
import { ChatEnvironment } from '../../domain/enums/chat-environment.enum';

describe('ChatController', () => {
  let controller: ChatController;
  let processOpenChatUseCase: ProcessOpenChatMessageUseCase;
  let processClosedChatUseCase: ProcessClosedChatMessageUseCase;
  let processApiChatUseCase: ProcessApiChatMessageUseCase;

  const mockOpenChatUseCase = {
    execute: jest.fn(),
  };

  const mockClosedChatUseCase = {
    execute: jest.fn(),
  };

  const mockApiChatUseCase = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ProcessOpenChatMessageUseCase,
          useValue: mockOpenChatUseCase,
        },
        {
          provide: ProcessClosedChatMessageUseCase,
          useValue: mockClosedChatUseCase,
        },
        {
          provide: ProcessApiChatMessageUseCase,
          useValue: mockApiChatUseCase,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    processOpenChatUseCase = module.get<ProcessOpenChatMessageUseCase>(ProcessOpenChatMessageUseCase);
    processClosedChatUseCase = module.get<ProcessClosedChatMessageUseCase>(ProcessClosedChatMessageUseCase);
    processApiChatUseCase = module.get<ProcessApiChatMessageUseCase>(ProcessApiChatMessageUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('processOpenMessage', () => {
    it('should process open chat message successfully', async () => {
      const request = {
        message: 'Hello',
        environment: ChatEnvironment.WEB,
        userId: 'user123',
      };

      const mockResult = {
        response: 'Hi there!',
        success: true,
      };

      mockOpenChatUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.processOpenMessage(request);

      expect(result).toEqual({
        response: 'Hi there!',
        success: true,
        error: undefined,
      });
      expect(mockOpenChatUseCase.execute).toHaveBeenCalledWith(request);
    });

    it('should handle errors in open chat', async () => {
      const request = {
        message: 'Hello',
        environment: ChatEnvironment.WEB,
      };

      const mockResult = {
        response: 'Error occurred',
        success: false,
        error: 'Something went wrong',
      };

      mockOpenChatUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.processOpenMessage(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });

  describe('processClosedMessage', () => {
    it('should process closed chat message successfully', async () => {
      const request = {
        message: 'Hello',
        environment: ChatEnvironment.WEB,
      };

      const mockResult = {
        response: 'Welcome!',
        success: true,
        nextState: { currentState: 'MENU', data: {} },
      };

      mockClosedChatUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.processClosedMessage(request);

      expect(result).toEqual({
        response: 'Welcome!',
        success: true,
        error: undefined,
        nextState: { currentState: 'MENU', data: {} },
      });
      expect(mockClosedChatUseCase.execute).toHaveBeenCalledWith(request);
    });
  });

  describe('processApiMessage', () => {
    it('should process API chat message successfully', async () => {
      const request = {
        message: 'Hello',
        environment: ChatEnvironment.WEB,
        userId: '12345678901',
      };

      const mockResult = {
        response: 'API response',
        success: true,
      };

      mockApiChatUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.processApiMessage(request);

      expect(result).toEqual({
        response: 'API response',
        success: true,
      });
      expect(mockApiChatUseCase.execute).toHaveBeenCalledWith('Hello', '12345678901');
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await controller.health();

      expect(result).toHaveProperty('status', 'OK');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
