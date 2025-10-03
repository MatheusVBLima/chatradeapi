import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for attending a ticket
 */
export class AtenderChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Attendant phone cannot be empty' })
  telefoneAtendente: string;
}

/**
 * DTO for finishing a ticket
 */
export class FinalizarChamadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Attendant phone cannot be empty' })
  telefoneAtendente: string;
}
