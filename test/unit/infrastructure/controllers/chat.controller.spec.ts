import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from '../../../../src/infrastructure/controllers/chat.controller';
import { ProcessOpenChatMessageUseCase } from '../../../../src/application/use-cases/process-open-chat-message.use-case';
import { ProcessClosedChatMessageUseCase } from '../../../../src/application/use-cases/process-closed-chat-message.use-case';
import { ChatEnvironment } from '../../../../src/domain/enums/chat-environment.enum';

describe('ChatController', () => {
  let controller: ChatController;
  let processOpenChatUseCase: ProcessOpenChatMessageUseCase;
  let processClosedChatUseCase: ProcessClosedChatMessageUseCase;

  const mockOpenChatUseCase = {
    execute: jest.fn(),
  };

  const mockClosedChatUseCase = {
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
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    processOpenChatUseCase = module.get<ProcessOpenChatMessageUseCase>(ProcessOpenChatMessageUseCase);
    processClosedChatUseCase = module.get<ProcessClosedChatMessageUseCase>(ProcessClosedChatMessageUseCase);
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

  describe('health', () => {
    it('should return health status', async () => {
      const result = await controller.health();

      expect(result).toHaveProperty('status', 'OK');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
