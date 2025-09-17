import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { ApiClientService } from '../services/api-client.service';

@Injectable()
export class ApiUserRepository implements UserRepository {
  constructor(private readonly apiClient: ApiClientService) {}

  async findById(id: string): Promise<User | null> {
    return this.findByCpf(id);
  }

  async findByCpf(cpf: string): Promise<User | null> {
    try {
      // First try as student
      try {
        const studentData = await this.apiClient.getStudentInfo(cpf);
        const user = new User();
        user.cpf = cpf;
        user.name = studentData.studentName;
        user.email = studentData.studentEmail;
        user.phone = studentData.studentPhone || '';
        user.role = 'student';
        user.id = cpf;
        user.createdAt = new Date();
        user.updatedAt = new Date();
        user.birthDate = new Date();
        user.address = {
          street: '',
          number: '',
          city: '',
          state: '',
          zipCode: ''
        };
        return user;
      } catch (studentError) {
        // If not student, try as coordinator
        try {
          const coordinatorData = await this.apiClient.getCoordinatorInfo(cpf);
          const user = new User();
          user.cpf = cpf;
          user.name = coordinatorData.coordinatorName;
          user.email = coordinatorData.coordinatorEmail;
          user.phone = coordinatorData.coordinatorPhone || '';
          user.role = 'coordinator';
          user.id = cpf;
          user.createdAt = new Date();
          user.updatedAt = new Date();
          user.birthDate = new Date();
          user.address = {
            street: '',
            number: '',
            city: '',
            state: '',
            zipCode: ''
          };
          return user;
        } catch (coordinatorError) {
          // User not found
          return null;
        }
      }
    } catch (error) {
      console.error(`Error finding user by CPF ${cpf}:`, error.message);
      return null;
    }
  }

  async findByPhone(phone: string): Promise<User | null> {
    // Not implemented for API - would require searching all users
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    // Not implemented for API - would require searching all users
    return null;
  }
}