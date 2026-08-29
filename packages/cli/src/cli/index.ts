#!/usr/bin/env node

import { runCli } from "./command/runner.js";

const status = await runCli(process.argv);
process.exitCode = status;
