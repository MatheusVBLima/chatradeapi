/**
 * Chat Environment Enum
 *
 * Define o ambiente onde o chat está sendo executado para controlar
 * como o telefone do usuário é obtido:
 *
 * - MOBILE: WhatsApp via Z-API
 *   - Produção: Telefone vem automaticamente do Z-API
 *   - Test: Usuário precisa digitar o telefone
 *
 * - WEB: Site/Browser
 *   - Produção: Usuário PRECISA digitar o telefone (sem Z-API)
 *   - Test: Usuário precisa digitar o telefone
 */
export enum ChatEnvironment {
  WEB = 'web',
  MOBILE = 'mobile',
}

/**
 * Determina se o telefone precisa ser solicitado ao usuário
 * baseado no ambiente e modo de execução
 */
export function shouldRequestPhone(
  environment: ChatEnvironment,
  isTestMode: boolean,
): boolean {
  // Web SEMPRE pede telefone (prod ou test)
  if (environment === ChatEnvironment.WEB) {
    return true;
  }

  // Mobile em PRODUÇÃO: Z-API fornece telefone automaticamente
  // Mobile em TEST: precisa pedir telefone
  if (environment === ChatEnvironment.MOBILE) {
    return isTestMode; // true = test, false = prod
  }

  // Default: pedir telefone para segurança
  return true;
}

/**
 * Determina se o telefone vem do Z-API
 */
export function isPhoneFromZapi(
  environment: ChatEnvironment,
  isTestMode: boolean,
): boolean {
  // Telefone só vem do Z-API em mobile produção
  return environment === ChatEnvironment.MOBILE && !isTestMode;
}
