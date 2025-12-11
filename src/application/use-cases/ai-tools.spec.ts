import { getVirtualAssistanceTools } from './ai-tools';

const mockConfigService = {
  get: (key: string, defaultValue?: any) => {
    if (key === 'REPORTS_ENABLED') return 'true';
    return defaultValue;
  },
} as any;

describe('getVirtualAssistanceTools', () => {
  const tools = getVirtualAssistanceTools(mockConfigService);

  it('returns parameters with type object for every tool', () => {
    Object.entries(tools).forEach(([toolName, def]) => {
      expect(def.parameters).toBeDefined();
      expect(def.parameters.type).toBe('object');
      expect(def.parameters.properties).toBeDefined();
    });
  });

  it('includes required fields for findPersonByName', () => {
    const findParams = tools.findPersonByName.parameters;
    expect(findParams.required).toEqual(
      expect.arrayContaining(['name', 'cpf']),
    );
  });

  it('adds generateReport when reports are enabled', () => {
    expect(tools.generateReport).toBeDefined();
    expect(tools.generateReport.parameters.type).toBe('object');
  });
});

