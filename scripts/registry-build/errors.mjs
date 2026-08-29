export class RegistryBuildError extends Error {
  constructor(message, details = [], options = {}) {
    super(message, options);
    this.name = "RegistryBuildError";
    this.details = details;
  }
}

export function throwRegistryBuildError(message, details = []) {
  throw new RegistryBuildError(message, details);
}
