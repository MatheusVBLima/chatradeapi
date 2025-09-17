import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/repositories/user.repository';
import { allMockUsers } from '../services/mock-virtual-assistance-data'; // Corrected path

@Injectable()
export class MockUserRepository implements UserRepository {

  private createDomainUserFromMock(mockUser: any): User | null { // Allow null return
    if (!mockUser) {
      return null;
    }
    const user = new User();
    user.id = mockUser.cpf;
    user.cpf = mockUser.cpf;
    user.name = mockUser.name;
    user.phone = mockUser.phone;
    user.email = mockUser.email;
    
    // Assign role based on the correct coordinator CPF
    user.role = mockUser.cpf === '111.111.111-11' ? 'coordinator' : 'student';

    user.university = 'Universidade Federal do Paraná'; 
    user.course = 'Medicina';
    
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.findByCpf(id);
  }

  async findByCpf(cpf: string): Promise<User | null> {
    const mockUser = allMockUsers.find(u => u.cpf === cpf);
    return this.createDomainUserFromMock(mockUser);
  }

  async findByPhone(phone: string): Promise<User | null> {
    const mockUser = allMockUsers.find(u => u.phone === phone);
    return this.createDomainUserFromMock(mockUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    const mockUser = allMockUsers.find(u => u.email === email);
    return this.createDomainUserFromMock(mockUser);
  }
}
 