import { Injectable } from '@nestjs/common';
import { ApiClientService, OngoingActivity, ScheduledActivity, Professional, Student, CoordinatorInfo, StudentInfo } from './api-client.service';

@Injectable()
export class ApiVirtualAssistanceService {
  constructor(private readonly apiClient: ApiClientService) {}

  async getCoordinatorOngoingActivities(cpf: string): Promise<OngoingActivity[]> {
    return this.apiClient.getCoordinatorOngoingActivities(cpf);
  }

  async getCoordinatorsOngoingActivities(cpf: string): Promise<OngoingActivity[]> {
    return this.apiClient.getCoordinatorOngoingActivities(cpf);
  }

  async getStudentsScheduledActivities(cpf: string): Promise<ScheduledActivity[]> {
    return this.apiClient.getStudentScheduledActivities(cpf);
  }

  async getStudentsProfessionals(cpf: string): Promise<Professional[]> {
    return this.apiClient.getStudentProfessionals(cpf);
  }

  async getCoordinatorProfessionals(cpf: string): Promise<Professional[]> {
    return this.apiClient.getCoordinatorProfessionals(cpf);
  }

  async getCoordinatorsProfessionals(cpf: string): Promise<Professional[]> {
    return this.apiClient.getCoordinatorProfessionals(cpf);
  }

  async getCoordinatorStudents(cpf: string): Promise<Student[]> {
    return this.apiClient.getCoordinatorStudents(cpf);
  }

  async getCoordinatorsStudents(cpf: string): Promise<Student[]> {
    return this.apiClient.getCoordinatorStudents(cpf);
  }

  async getCoordinatorInfo(cpf: string): Promise<CoordinatorInfo> {
    return this.apiClient.getCoordinatorInfo(cpf);
  }

  async getStudentInfo(cpf: string): Promise<StudentInfo> {
    return this.apiClient.getStudentInfo(cpf);
  }

  async getCoordinatorDetails(cpf: string): Promise<any> {
    return this.apiClient.getCoordinatorInfo(cpf);
  }

  async getAllUserData(cpf: string): Promise<{
    coordinatorInfo?: CoordinatorInfo;
    ongoingActivities?: OngoingActivity[];
    scheduledActivities?: ScheduledActivity[];
    professionals?: Professional[];
    students?: Student[];
  }> {
    const data: any = {};
    let coordinatorError: any = null;

    console.log(`[DEBUG] Tentando buscar dados para CPF: ${cpf}`);

    // Primeiro tenta como coordenador
    console.log(`[DEBUG] Tentando buscar como coordenador...`);
    try {
      data.coordinatorInfo = await this.getCoordinatorInfo(cpf);
      data.ongoingActivities = await this.getCoordinatorOngoingActivities(cpf);
      data.professionals = await this.getCoordinatorProfessionals(cpf);
      data.students = await this.getCoordinatorStudents(cpf);
      console.log(`[DEBUG] Dados de coordenador obtidos com sucesso`);
      return data;
    } catch (error) {
      coordinatorError = error;
      console.log(`[DEBUG] Erro ao buscar como coordenador:`, error.message);
    }

    // Se não for coordenador, tenta como estudante
    console.log(`[DEBUG] Tentando buscar como estudante...`);
    try {
      data.scheduledActivities = await this.getStudentsScheduledActivities(cpf);
      data.professionals = await this.getStudentsProfessionals(cpf);
      console.log(`[DEBUG] Dados de estudante obtidos com sucesso`);
      return data;
    } catch (studentError) {
      console.log(`[DEBUG] Erro ao buscar como estudante:`, studentError.message);
      throw new Error(`Usuário não encontrado: CPF ${cpf} não é nem coordenador nem estudante. Coordenador: ${coordinatorError?.message || 'N/A'}, Estudante: ${studentError.message}`);
    }
  }
}