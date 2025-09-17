import { Injectable } from '@nestjs/common';
import { 
  VirtualAssistanceService,
  OngoingActivity, 
  ScheduledActivity, 
  Professional, 
  Student, 
  Coordinator,
  StudentInfo,
  CoordinatorInfo 
} from '../../domain/services/virtual-assistance.service';
import { 
  ongoingActivities, 
  scheduledActivities,
  studentProfessionals,
  coordinatorProfessionals,
  coordinatorStudents,
  coordinatorDetails 
} from './mock-virtual-assistance-data';

@Injectable()
export class MockVirtualAssistanceService implements VirtualAssistanceService {
  async getCoordinatorsOngoingActivities(cpf: string): Promise<OngoingActivity[]> {
    // In a real scenario, we would use the coordinator's CPF to filter data.
    // For this mock, we return all coordinator-visible data.
    console.log(`Mock: Coordenador ${cpf} pediu atividades em andamento.`);
    return ongoingActivities;
  }

  async getCoordinatorsProfessionals(cpf: string): Promise<Professional[]> {
    console.log(`Mock: Coordenador ${cpf} pediu lista de profissionais.`);
    return coordinatorProfessionals;
  }

  async getCoordinatorsStudents(cpf: string): Promise<Student[]> {
    console.log(`Mock: Coordenador ${cpf} pediu lista de alunos.`);
    return coordinatorStudents;
  }

  async getCoordinatorDetails(cpf: string): Promise<Coordinator | null> {
    console.log(`Mock: Pedido de detalhes para o coordenador com CPF ${cpf}.`);
    // In a real implementation, you'd find the coordinator by CPF.
    return coordinatorDetails.cpf === cpf ? coordinatorDetails : null;
  }

  async getStudentsScheduledActivities(cpf: string): Promise<ScheduledActivity[]> {
    console.log(`Mock: Buscando atividades agendadas para o CPF ${cpf}.`);
    
    // Se for coordenador, retorna TODAS as atividades agendadas
    if (cpf === coordinatorDetails.cpf || cpf === '111.111.111-11') {
      console.log(`Mock: Coordenador tem acesso a TODAS as ${scheduledActivities.length} atividades agendadas.`);
      return scheduledActivities;
    }
    
    // Se for estudante, filtra pelos grupos do estudante
    const student = coordinatorStudents.find(s => s.cpf === cpf);
    if (!student) {
      console.log(`Mock: Estudante com CPF ${cpf} não encontrado.`);
      return [];
    }
    
    // Filter activities by student's groups
    const filteredActivities = scheduledActivities.filter(activity => 
      student.groupNames.includes(activity.groupName)
    );
    
    console.log(`Mock: Encontradas ${filteredActivities.length} atividades para os grupos do estudante: ${student.groupNames.join(', ')}`);
    return filteredActivities;
  }

  async getStudentsProfessionals(cpf: string): Promise<Professional[]> {
    console.log(`Mock: Buscando profissionais para o CPF ${cpf}.`);
    
    // Se for coordenador, retorna TODOS os profissionais
    if (cpf === coordinatorDetails.cpf || cpf === '111.111.111-11') {
      console.log(`Mock: Coordenador tem acesso a TODOS os ${studentProfessionals.length} profissionais.`);
      return studentProfessionals;
    }
    
    // Se for estudante, filtra pelos grupos do estudante
    const student = coordinatorStudents.find(s => s.cpf === cpf);
    if (!student) {
      console.log(`Mock: Estudante com CPF ${cpf} não encontrado.`);
      return [];
    }
    
    // Filter professionals by student's groups (professionals that work in the same groups)
    const filteredProfessionals = studentProfessionals.filter(professional => 
      professional.groupNames.some(group => student.groupNames.includes(group))
    );
    
    console.log(`Mock: Encontrados ${filteredProfessionals.length} profissionais para os grupos do estudante: ${student.groupNames.join(', ')}`);
    return filteredProfessionals;
  }

  async getStudentInfo(cpf: string): Promise<StudentInfo> {
    console.log(`Mock: Buscando informações do estudante ${cpf}.`);
    
    // Find student in coordinatorStudents
    const student = coordinatorStudents.find(s => s.cpf === cpf);
    if (!student) {
      throw new Error(`Estudante com CPF ${cpf} não encontrado.`);
    }
    
    // Convert to StudentInfo format
    return {
      studentName: student.name,
      studentEmail: student.email,
      studentPhone: student.phone || '',
      groupNames: student.groupNames,
      organizationsAndCourses: [
        {
          organizationName: 'Universidade Federal do Paraná',
          courseNames: ['Medicina']
        }
      ]
    };
  }

  async getCoordinatorInfo(cpf: string): Promise<CoordinatorInfo> {
    console.log(`Mock: Buscando informações do coordenador ${cpf}.`);
    
    if (coordinatorDetails.cpf !== cpf && cpf !== '111.111.111-11') {
      throw new Error(`Coordenador com CPF ${cpf} não encontrado.`);
    }
    
    // Convert to CoordinatorInfo format
    return {
      coordinatorName: coordinatorDetails.coordinatorName,
      coordinatorEmail: coordinatorDetails.coordinatorEmail,
      coordinatorPhone: coordinatorDetails.coordinatorPhone,
      groupNames: coordinatorDetails.groupNames,
      organizationsAndCourses: coordinatorDetails.organizationsAndCourses
    };
  }
} 