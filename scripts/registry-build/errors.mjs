export class RegistryBuildError extends Error {
  constructor(message, details = [], options = {}) {
    super(message, options);
    this.name = "RegistryBuildError";
    this.details = details;
  }
}
