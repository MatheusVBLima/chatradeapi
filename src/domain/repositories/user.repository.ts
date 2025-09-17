import { User } from '../entities/user.entity';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByCpf(cpf: string): Promise<User | null>;
} 