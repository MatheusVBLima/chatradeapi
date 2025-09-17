import { Injectable, Inject } from '@nestjs/common';
import { AIService } from '../../domain/services/ai.service';
import { ApiVirtualAssistanceService } from '../../infrastructure/services/api-virtual-assistance.service';

@Injectable()
export class ProcessApiChatMessageUseCase {
  constructor(
    @Inject('AIService') private readonly aiService: AIService,
    private readonly virtualAssistanceService: ApiVirtualAssistanceService,
  ) {}

  async execute(message: string, userId: string): Promise<{ response: string; success: boolean }> {
    try {
      console.log(`[DEBUG] Processando mensagem para CPF: ${userId}`);
      const userData = await this.virtualAssistanceService.getAllUserData(userId);
      console.log(`[DEBUG] Dados obtidos da API:`, JSON.stringify(userData, null, 2));
      
      const systemPrompt = this.buildSystemPrompt(userData);
      const fullPrompt = `${systemPrompt}\n\nUsuário: ${message}`;

      // Criar um objeto User temporário para compatibilidade com a interface
      const tempUser = {
        id: userId,
        name: 'API User',
        email: '',
        phone: '',
        cpf: userId,
        role: 'student',
        birthDate: new Date(),
        address: { street: '', number: '', city: '', state: '', zipCode: '' },
        createdAt: new Date(),
        updatedAt: new Date(),
        subjects: []
      } as any;

      const aiResponse = await this.aiService.generateResponse(fullPrompt, tempUser);
      
      return {
        response: aiResponse,
        success: true,
      };
    } catch (error) {
      console.error('Erro no ProcessApiChatMessageUseCase:', error);
      console.error('Stack trace:', error.stack);
      return {
        response: `Erro: ${error.message}`,
        success: false,
      };
    }
  }

  private buildSystemPrompt(userData: any): string {
    let systemPrompt = `Você é um assistente virtual especializado em auxiliar profissionais da área da saúde em suas atividades acadêmicas e de estágio.

DADOS DO USUÁRIO DISPONÍVEIS:
`;

    if (userData.coordinatorInfo) {
      systemPrompt += `
PERFIL: Coordenador(a)
Nome: ${userData.coordinatorInfo.coordinatorName}
Email: ${userData.coordinatorInfo.coordinatorEmail}
Telefone: ${userData.coordinatorInfo.coordinatorPhone || 'Não informado'}
Grupos coordenados: ${userData.coordinatorInfo.groupNames.join(', ')}

ORGANIZAÇÕES E CURSOS:
${userData.coordinatorInfo.organizationsAndCourses.map(org => 
  `- ${org.organizationName}: ${org.courseNames.join(', ')}`
).join('\n')}
`;

      if (userData.ongoingActivities?.length > 0) {
        systemPrompt += `\nATIVIDADES EM ANDAMENTO DOS ESTUDANTES:
${userData.ongoingActivities.map(activity => 
  `- ${activity.studentName} (${activity.groupName}): ${activity.taskName} em ${activity.internshipLocationName}
    Horário programado: ${new Date(activity.scheduledStartTo).toLocaleString('pt-BR')} às ${new Date(activity.scheduledEndTo).toLocaleString('pt-BR')}
    Início real: ${new Date(activity.startedAt).toLocaleString('pt-BR')}
    Preceptor: ${activity.preceptorName}`
).join('\n')}`;
      }

      if (userData.professionals?.length > 0) {
        systemPrompt += `\nPROFISSIONAIS SUPERVISIONADOS:
${userData.professionals.map(prof => 
  `- ${prof.name} (CPF: ${prof.cpf})
    Email: ${prof.email}
    Telefone: ${prof.phone || 'Não informado'}
    Grupos: ${prof.groupNames.join(', ')}
    ${prof.pendingValidationWorkloadMinutes ? `Carga horária pendente: ${prof.pendingValidationWorkloadMinutes} minutos` : ''}`
).join('\n')}`;
      }

      if (userData.students?.length > 0) {
        systemPrompt += `\nESTUDANTES SUPERVISIONADOS:
${userData.students.map(student => 
  `- ${student.name} (CPF: ${student.cpf})
    Email: ${student.email}
    Telefone: ${student.phone || 'Não informado'}
    Grupos: ${student.groupNames.join(', ')}`
).join('\n')}`;
      }
    } else {
      systemPrompt += `
PERFIL: Estudante/Profissional
`;

      if (userData.scheduledActivities?.length > 0) {
        systemPrompt += `\nSUAS ATIVIDADES AGENDADAS:
${userData.scheduledActivities.map(activity => 
  `- ${activity.taskName} (${activity.groupName})
    Local: ${activity.internshipLocationName}
    Data/Hora: ${new Date(activity.scheduledStartTo).toLocaleString('pt-BR')} às ${new Date(activity.scheduledEndTo).toLocaleString('pt-BR')}
    Preceptores: ${activity.preceptorNames.join(', ')}`
).join('\n')}`;
      }

      if (userData.professionals?.length > 0) {
        systemPrompt += `\nSEUS PRECEPTORES:
${userData.professionals.map(prof => 
  `- ${prof.name} (CPF: ${prof.cpf})
    Email: ${prof.email}
    Telefone: ${prof.phone || 'Não informado'}
    Grupos: ${prof.groupNames.join(', ')}`
).join('\n')}`;
      }
    }

    systemPrompt += `

INSTRUÇÕES:
- Responda sempre em português brasileiro
- Use as informações disponíveis para fornecer respostas precisas e úteis
- Se não tiver informação específica, seja claro sobre isso
- Mantenha um tom profissional e acolhedor
- Foque em questões relacionadas às atividades acadêmicas, estágios e coordenação
- Para perguntas sobre horários, use o formato brasileiro (dd/mm/aaaa hh:mm)`;

    return systemPrompt;
  }
}