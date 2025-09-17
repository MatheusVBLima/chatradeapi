import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiClientService } from '../services/api-client.service';

@Controller('debug')
export class DebugController {
  constructor(
    private readonly apiClientService: ApiClientService,
  ) {}

  @Get('test-rade-connection/:cpf')
  @HttpCode(HttpStatus.OK)
  async testRadeConnection(@Param('cpf') cpf: string) {
    try {
      console.log(`[DEBUG] Testing RADE connection for CPF: ${cpf}`);
      
      // Test student endpoint
      const studentInfo = await this.apiClientService.getStudentInfo(cpf);
      
      return {
        success: true,
        cpf,
        studentInfo,
        message: 'RADE connection successful',
      };
    } catch (error) {
      console.error('[DEBUG] RADE connection failed:', error.message);
      
      return {
        success: false,
        cpf,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: 'RADE connection failed',
      };
    }
  }
}