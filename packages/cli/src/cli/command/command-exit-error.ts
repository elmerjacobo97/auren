export class CommandExitError extends Error {
  constructor(readonly status: number) {
    super(`Command exited with status ${status}`);
    this.name = "CommandExitError";
  }
}
