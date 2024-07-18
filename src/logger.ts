import pino, { Logger } from "pino";
import { LogLevel, BaseLogger } from "@credo-ts/core";
export { LogLevel } from "@credo-ts/core";

export const pertTransport = pino.transport({
  targets: [
    {
      level: "trace",
      target: "pino/file",
      options: {
        destination: "./log.perf.ndjson",
        autoEnd: true,
      },
    },
  ],
});

export const loggerTransport = pino.transport({
  targets: [
    {
      level: "trace",
      target: "pino/file",
      options: {
        destination: "./log.ndjson",
        autoEnd: true,
      },
    },
  ],
});

export const logger = pino(
  { level: "trace", timestamp: pino.stdTimeFunctions.isoTime },
  loggerTransport
);

export class PinoLogger extends BaseLogger {
  logger: Logger;
  constructor(logger: Logger, logLevel: LogLevel) {
    super(logLevel);
    this.logger = logger;
  }
  test(message: string, data?: Record<string, any> | undefined): void {
    this.logger.debug(data || {}, message);
  }
  trace(message: string, data?: Record<string, any> | undefined): void {
    this.logger.trace(data || {}, message);
  }
  debug(message: string, data?: Record<string, any> | undefined): void {
    this.logger.debug(data || {}, message);
  }
  info(message: string, data?: Record<string, any> | undefined): void {
    this.logger.info(data || {}, message);
  }
  warn(message: string, data?: Record<string, any> | undefined): void {
    this.logger.warn(data || {}, message);
  }
  error(message: string, data?: Record<string, any> | undefined): void {
    this.logger.error(data || {}, message);
  }
  fatal(message: string, data?: Record<string, any> | undefined): void {
    //console.dir(data)
    this.logger.fatal(data || {}, message);
  }
}
