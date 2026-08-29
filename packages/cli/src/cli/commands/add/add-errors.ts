function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class MissingAurenConfigurationError extends Error {
  constructor() {
    super(
      'Auren is not initialized: "auren.json" is missing; run "auren init" first',
    );
    this.name = "MissingAurenConfigurationError";
  }
}

export class IncompatibleProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncompatibleProjectError";
  }
}

export class IncompatibleCatalogElementError extends Error {
  constructor(
    readonly id: string,
    message: string,
  ) {
    super(`Catalog element "${id}" is not compatible: ${message}`);
    this.name = "IncompatibleCatalogElementError";
  }
}

export class MissingInstallableRecordError extends Error {
  constructor(readonly id: string) {
    super(`Installable catalog record not found for "${id}"`);
    this.name = "MissingInstallableRecordError";
  }
}

export class MissingInstallSourceFileError extends Error {
  constructor(readonly sourcePath: string) {
    super(`Block source file not found: "${sourcePath}"`);
    this.name = "MissingInstallSourceFileError";
  }
}

export class UnsafeInstallTargetError extends Error {
  constructor(readonly targetPath: string) {
    super(`Unsafe installation target: "${targetPath}"`);
    this.name = "UnsafeInstallTargetError";
  }
}

export class DuplicateInstallTargetError extends Error {
  constructor(readonly targetPath: string) {
    super(
      `Multiple block files resolve to the installation target "${targetPath}"`,
    );
    this.name = "DuplicateInstallTargetError";
  }
}

export class ExistingInstallTargetError extends Error {
  constructor(readonly targetPath: string) {
    super(
      `Installation target already exists: "${targetPath}"; pass --force to replace it`,
    );
    this.name = "ExistingInstallTargetError";
  }
}

export class InvalidInstallAliasError extends Error {
  constructor(readonly alias: string) {
    super(`Unknown or unsafe configured alias reference "${alias}"`);
    this.name = "InvalidInstallAliasError";
  }
}

export class AddWriteError extends Error {
  constructor(
    readonly targetPath: string,
    cause: unknown,
  ) {
    super(`Failed to install file "${targetPath}": ${messageOf(cause)}`, {
      cause,
    });
    this.name = "AddWriteError";
  }
}
