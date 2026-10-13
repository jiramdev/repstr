export const MIN_PASSWORD_LENGTH = 8;

export function passwordRuleError(password: string, label = "Password") {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `${label} must be at least 8 characters.`;
  }
  return null;
}
