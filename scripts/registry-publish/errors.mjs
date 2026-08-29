export class RegistryPublishError extends Error {
  constructor(message, details = [], options = {}) {
    super(message, options);
    this.name = "RegistryPublishError";
    this.details = details;
  }
}
