import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';

/**
 * DTO for report generation requests
 */
export class GenerateReportDto {
  @IsEnum(['pdf', 'csv', 'txt'], { message: 'Format must be "pdf", "csv", or "txt"' })
  format: 'pdf' | 'csv' | 'txt';

  @IsString()
  @IsNotEmpty({ message: 'CPF cannot be empty' })
  cpf: string;

  @IsString()
  @IsOptional()
  fieldsRequested?: string;
}

/**
 * DTO for report response
 */
export class ReportResponseDto {
  @IsString()
  downloadUrl?: string;

  @IsString()
  @IsOptional()
  error?: string;

  @IsNotEmpty()
  success: boolean;
}
