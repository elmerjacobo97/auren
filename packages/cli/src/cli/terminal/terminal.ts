import { log } from "@clack/prompts";
import { Writable } from "node:stream";
import pc from "picocolors";

export type TerminalWriter = Writable | ((text: string) => void);

export interface TerminalOptions {
  stdout?: TerminalWriter;
  stderr?: TerminalWriter;
  color?: boolean;
}

export interface Terminal {
  writeOut(text: string): void;
  writeErr(text: string): void;
  error(error: unknown): void;
}

function toWritable(writer: TerminalWriter): Writable {
  if (typeof writer !== "function") {
    return writer;
  }

  return new Writable({
    write(chunk, _encoding, callback) {
      writer(chunk.toString());
      callback();
    },
  });
}

function isTty(writer: Writable): boolean {
  return "isTTY" in writer && writer.isTTY === true;
}

function formatError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unexpected CLI failure.";
  const firstLine = message.split(/\r?\n/, 1)[0]?.trim() ?? "";
  const withoutPrefix = firstLine.replace(/^error:\s*/i, "");

  return withoutPrefix || "Unexpected CLI failure.";
}

export function createTerminal(options: TerminalOptions = {}): Terminal {
  const stdout = toWritable(options.stdout ?? process.stdout);
  const stderr = toWritable(options.stderr ?? process.stderr);
  const colorEnabled =
    options.color ?? (pc.isColorSupported && (isTty(stdout) || isTty(stderr)));
  const colors = pc.createColors(colorEnabled);

  return {
    writeOut(text) {
      stdout.write(text);
    },
    writeErr(text) {
      stderr.write(text);
    },
    error(error) {
      log.message(`${colors.red("error:")} ${formatError(error)}`, {
        output: stderr,
        spacing: 0,
        withGuide: false,
      });
    },
  };
}

export { formatError };
