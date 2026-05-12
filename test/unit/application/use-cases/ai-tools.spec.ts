import { getVirtualAssistanceTools } from '../../../../src/application/use-cases/ai-tools';

const mockConfigService = {
  get: (key: string, defaultValue?: any) => {
    if (key === 'REPORTS_ENABLED') return 'true';
    return defaultValue;
  },
} as any;

describe('getVirtualAssistanceTools', () => {
  const tools = getVirtualAssistanceTools(mockConfigService);
  const sampleCpf = '12345678901';

  it('returns parameters with type object for every tool', () => {
    Object.entries(tools).forEach(([toolName, def]) => {
      const sample =
        toolName === 'findPersonByName'
          ? { name: 'Pessoa Teste', cpf: sampleCpf }
          : { cpf: sampleCpf };

      expect(def.parameters).toBeDefined();
      expect(def.parameters.safeParse(sample).success).toBe(true);
    });
  });

  it('includes required fields for findPersonByName', () => {
    const findParams = tools.findPersonByName.parameters;
    expect(findParams.safeParse({ name: 'Pessoa Teste', cpf: sampleCpf }).success).toBe(
      true,
    );
    expect(findParams.safeParse({ cpf: sampleCpf }).success).toBe(false);
  });

  it('adds generateReport when reports are enabled', () => {
    expect(tools.generateReport).toBeDefined();
    expect(tools.generateReport.parameters.safeParse({ cpf: sampleCpf }).success).toBe(
      true,
    );
  });
});

