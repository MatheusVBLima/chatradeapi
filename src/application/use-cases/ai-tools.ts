import { z } from 'zod';
import { ConfigService } from '@nestjs/config';

// =====================================================
// SCHEMAS ZOD - Definições dos parâmetros das tools
// =====================================================

// Schema para tools que precisam apenas do CPF do usuário logado
export const cpfSchema = z.object({
  cpf: z
    .string()
    .describe('O CPF do usuário a ser consultado. Deve conter 11 dígitos.'),
});

// Schema para busca de pessoa por nome
export const findPersonSchema = z.object({
  name: z.string().describe('Nome da pessoa (ex: "João Silva", "Dra. Ana")'),
  cpf: z.string().describe('CPF do usuário logado fazendo a busca'),
});

// Schema para geração de relatórios
export const generateReportSchema = z.object({
  cpf: z.string().describe('CPF do usuário logado'),
  sectionLabels: z
    .array(z.string())
    .optional()
    .describe(
      '⚠️ LABELS DESCRITIVAS: Crie labels claras e descritivas para cada seção do relatório baseadas no que o usuário pediu. Exemplos: ["Email e Grupo do Aluno Joaquim", "Dados Completos da Preceptora Eugenia"] ou ["Informações de Contato", "Dados Acadêmicos"]. Uma label para cada fonte de dados buscada.',
    ),
  sectionFilters: z
    .array(z.string())
    .optional()
    .describe(
      '⚠️ FILTROS POR SEÇÃO: Array com filtros específicos para cada seção (mesma ordem que sectionLabels). Use palavras em PORTUGUÊS (nome, email, telefone, grupo, curso, instituição). Exemplos: ["email, grupo, curso", ""] = primeira seção só email/grupo/curso, segunda seção todos os dados. ["nome", "email, telefone"] = primeira seção só nome, segunda seção email e telefone. Se não especificar filtro para uma seção, use string vazia "" para incluir todos os dados.',
    ),
});

// =====================================================
// TOOL DEFINITIONS - Definições das tools com schemas
// =====================================================
// No AI SDK v5, o tool() requer execute function
// Por isso, exportamos as definições separadamente e
// o service adiciona o execute dinamicamente

export interface ToolDefinition {
  description: string;
  parameters: z.ZodSchema;
}

export const toolDefinitions: Record<string, ToolDefinition> = {
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
    parameters: findPersonSchema,
  },
};

// Definition for generateReport (added conditionally)
export const generateReportDefinition: ToolDefinition = {
  description:
    '⚠️ OBRIGATÓRIO: EXECUTE ESTA TOOL imediatamente quando usuário pedir "relatório"/"PDF"/"exportar"/"download"/"gerar arquivo". NUNCA apenas retorne dados formatados - você DEVE executar generateReport. SEQUÊNCIA: 1) busque dados necessários, 2) EXECUTE generateReport, 3) retorne link. Gera arquivo PDF dos dados obtidos nas ferramentas anteriores. RETORNA: {downloadUrl: "link_para_download"} ou {error: "mensagem"}.',
  parameters: generateReportSchema,
};

// =====================================================
// FACTORY FUNCTION - Retorna tools baseado na config
// =====================================================
export const getVirtualAssistanceToolDefinitions = (
  configService: ConfigService,
): Record<string, ToolDefinition> => {
  const reportsEnabled =
    configService.get('REPORTS_ENABLED', 'true') === 'true';

  const tools = { ...toolDefinitions };

  // Conditionally add generateReport tool only if enabled
  if (reportsEnabled) {
    tools.generateReport = generateReportDefinition;
  }

  return tools;
};

// ✅ Função de compatibilidade - retorna as mesmas definições
// Esta função é chamada por open-chat.flow.ts
export const getVirtualAssistanceTools = (
  configService: ConfigService,
): Record<string, ToolDefinition> => {
  return getVirtualAssistanceToolDefinitions(configService);
};