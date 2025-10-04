import { z } from 'zod';
import { tool } from 'ai';
import { ConfigService } from '@nestjs/config';

const cpfSchema = z.object({
  cpf: z
    .string()
    .describe('O CPF do usuário a ser consultado. Deve conter 11 dígitos.'),
});

export const getVirtualAssistanceTools = (configService: ConfigService) => {
  const reportsEnabled =
    configService.get('REPORTS_ENABLED', 'true') === 'true';

  const tools = {
    // --- Coordinator Tools ---
    getCoordinatorsOngoingActivities: tool({
      description:
        'Lista atividades em andamento no momento. RETORNA: Array de {studentName, groupName, taskName, internshipLocationName, scheduledStartTo, scheduledEndTo, startedAt, preceptorName} ou [] se vazio.',
      parameters: cpfSchema,
    }),
    getCoordinatorsProfessionals: tool({
      description:
        'Lista profissionais (preceptores) supervisionados pelo coordenador. RETORNA: Array de {cpf, name, email, phone, groupNames[]} ou [] se vazio.',
      parameters: cpfSchema,
    }),
    getCoordinatorsStudents: tool({
      description:
        'Lista estudantes supervisionados pelo coordenador (pode ser 100+ registros). RETORNA: Array de {cpf, name, email, phone, groupNames[]} ou [] se vazio.',
      parameters: cpfSchema,
    }),

    // --- Student/Professional Tools ---
    getStudentsScheduledActivities: tool({
      description:
        'Lista atividades futuras agendadas do estudante. RETORNA: Array de {groupName, taskName, internshipLocationName, scheduledStartTo, scheduledEndTo, preceptorNames[]} ou [] se vazio.',
      parameters: cpfSchema,
    }),
    getStudentsProfessionals: tool({
      description:
        'Lista preceptores/professores do estudante. RETORNA: Array de {cpf, name, email, phone, groupNames[]} ou [] se vazio.',
      parameters: cpfSchema,
    }),
    getStudentInfo: tool({
      description:
        'Dados pessoais completos do estudante. RETORNA: {studentName, studentEmail, studentPhone, groupNames[], organizationsAndCourses[{organizationName, courseNames[]}]}. Use para "meus dados".',
      parameters: cpfSchema,
    }),

    // --- Coordinator Info Tools ---
    getCoordinatorInfo: tool({
      description:
        'Dados pessoais completos do coordenador. RETORNA: {coordinatorName, coordinatorEmail, coordinatorPhone, groupNames[], organizationsAndCourses[{organizationName, courseNames[]}]}. Use para "meus dados".',
      parameters: cpfSchema,
    }),

    // --- Search Tools ---
    findPersonByName: tool({
      description:
        'Busca pessoa por nome nos dados já carregados. RETORNA: {cpf, name, email, phone, groupNames[]} ou {error: "mensagem"} se não encontrado.',
      parameters: z.object({
        name: z
          .string()
          .describe('Nome da pessoa (ex: "João Silva", "Dra. Ana")'),
        cpf: z.string().describe('CPF do usuário logado fazendo a busca'),
      }),
    }),
  };

  // Conditionally add generateReport tool only if enabled
  if (reportsEnabled) {
    (tools as any).generateReport = tool({
      description:
        '⚠️ EXECUTE ESTA TOOL quando usuário pedir "relatório"/"PDF"/"CSV"/"TXT"/"exportar"/"download". NUNCA retorne código ou tool_codeprint - EXECUTE a tool diretamente. Gera arquivo dos dados obtidos nas ferramentas anteriores. NUNCA retorne dados formatados sem EXECUTAR esta ferramenta quando o usuário pedir arquivo. RETORNA: {downloadUrl: "link_para_download"} ou {error: "mensagem"}.',
      parameters: z.object({
        format: z
          .enum(['pdf', 'csv', 'txt'])
          .describe('Formato: pdf (padrão), csv ou txt'),
        cpf: z.string().describe('CPF do usuário logado'),
        fieldsRequested: z
          .string()
          .optional()
          .describe(
            'Campos específicos solicitados pelo usuário (ex: "nome e email"). Opcional.',
          ),
      }),
    });
  }

  return tools;
};
