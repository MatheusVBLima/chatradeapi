import { z } from 'zod';
import { ConfigService } from '@nestjs/config';

const cpfSchema = z.object({
  cpf: z
    .string()
    .describe('O CPF do usuário a ser consultado. Deve conter 11 dígitos.'),
});

// ✅ NOTA: As execute functions serão adicionadas no GeminiAIService
// que já tem acesso a todos os serviços necessários
export const getVirtualAssistanceTools = (configService: ConfigService) => {
  const reportsEnabled =
    configService.get('REPORTS_ENABLED', 'true') === 'true';

  // AI SDK v5: Define tools as plain objects without the tool() wrapper
  const tools = {
    // --- Coordinator Tools ---
    getCoordinatorsOngoingActivities: {
      description:
        'Lista atividades em andamento no momento. RETORNA: Array de {studentName, groupName, taskName, internshipLocationName, scheduledStartTo, scheduledEndTo, startedAt, preceptorName} ou [] se vazio.',
      parameters: cpfSchema,
    },
    getCoordinatorsProfessionals: {
      description:
        'Lista profissionais (preceptores) supervisionados pelo coordenador. RETORNA: Array de {cpf, name, email, phone, groupNames[]} ou [] se vazio.',
      parameters: cpfSchema,
    },
    getCoordinatorsStudents: {
      description:
        'Lista estudantes supervisionados pelo coordenador (pode ser 100+ registros). RETORNA: Array de {cpf, name, email, phone, groupNames[]} ou [] se vazio.',
      parameters: cpfSchema,
    },

    // --- Student/Professional Tools ---
    getStudentsScheduledActivities: {
      description:
        'Lista atividades futuras agendadas do estudante. RETORNA: Array de {groupName, taskName, internshipLocationName, scheduledStartTo, scheduledEndTo, preceptorNames[]} ou [] se vazio.',
      parameters: cpfSchema,
    },
    getStudentsProfessionals: {
      description:
        'Lista preceptores/professores do estudante. RETORNA: Array de {cpf, name, email, phone, groupNames[]} ou [] se vazio.',
      parameters: cpfSchema,
    },
    getStudentInfo: {
      description:
        'Dados pessoais completos do estudante. RETORNA: {studentName, studentEmail, studentPhone, groupNames[], organizationsAndCourses[{organizationName, courseNames[]}]}. Use para "meus dados".',
      parameters: cpfSchema,
    },

    // --- Coordinator Info Tools ---
    getCoordinatorInfo: {
      description:
        'Dados pessoais completos do coordenador. RETORNA: {coordinatorName, coordinatorEmail, coordinatorPhone, groupNames[], organizationsAndCourses[{organizationName, courseNames[]}]}. Use para "meus dados".',
      parameters: cpfSchema,
    },

    // --- Search Tools ---
    findPersonByName: {
      description:
        'Busca pessoa por nome nos dados já carregados. RETORNA: {cpf, name, email, phone, groupNames[]} ou {error: "mensagem"} se não encontrado.',
      parameters: z.object({
        name: z
          .string()
          .describe('Nome da pessoa (ex: "João Silva", "Dra. Ana")'),
        cpf: z.string().describe('CPF do usuário logado fazendo a busca'),
      }),
    },
  };

  // Conditionally add generateReport tool only if enabled
  if (reportsEnabled) {
    (tools as any).generateReport = {
      description:
        '⚠️ OBRIGATÓRIO: EXECUTE ESTA TOOL imediatamente quando usuário pedir "relatório"/"PDF"/"CSV"/"TXT"/"exportar"/"download"/"gerar arquivo"/"gere um PDF". NUNCA apenas retorne dados formatados - você DEVE executar generateReport. SEQUÊNCIA: 1) busque dados necessários, 2) EXECUTE generateReport, 3) retorne link. Gera arquivo dos dados obtidos nas ferramentas anteriores. RETORNA: {downloadUrl: "link_para_download"} ou {error: "mensagem"}.',
      parameters: z.object({
        format: z
          .enum(['pdf', 'csv', 'txt'])
          .describe('Formato: pdf (padrão), csv ou txt'),
        cpf: z.string().describe('CPF do usuário logado'),
        fieldsRequested: z
          .string()
          .optional()
          .describe(
            '⚠️ IMPORTANTE: Se o usuário especificar campos (ex: "meu curso, grupo e email da eugenia", "apenas nome e telefone"), EXTRAIA e liste aqui separados por vírgula (ex: "curso, grupo, email, nome, telefone"). Se não especificar, deixe vazio para incluir todos os dados. Palavras-chave comuns: nome, email, telefone, curso, grupo, instituição, organização.',
          ),
      }),
    };
  }

  return tools;
};
