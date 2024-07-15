import {describe, expect, test} from '@jest/globals';
import { AgentTraction } from './AgentTraction';
import { AgentCredo } from './AgentCredo';
import { Logger, LogLevel } from '@credo-ts/core';
import { PersonSchema1 } from './mocks';
import { CredentialDefinitionBuilder } from './lib';
import pino from 'pino';
import { PinoLogger } from './index2';

describe('connectionless', () => {
    const config = require('../local.env.json')["sovrin_testnet"]
    const ledgers  = require('../ledgers.json')
    const loggerTransport = pino.transport({
        targets: [
          {
            level: 'trace',
            target: 'pino/file',
            options: {
              destination: './log.ndjson',
              autoEnd: true,
            },
          }
        ],
      })
    const logger = pino(
        { level: "trace", timestamp: pino.stdTimeFunctions.isoTime },
        loggerTransport
    );
    const agentA = new AgentTraction(config)
    const agentB = new AgentCredo(config, ledgers, new PinoLogger(logger, LogLevel.trace))

    beforeAll(async () => {
        await Promise.all([agentA.startup(), agentB.startup()])
        const schema = new PersonSchema1()
        const credDef = new CredentialDefinitionBuilder().setSchema(schema).setSupportRevocation(true)
  
        await agentA.createSchema(schema)
        await agentA.createSchemaCredDefinition(credDef)
        //await agentA.clearAllRecords()
    }, 20000)
    afterAll(async () => {
        await agentB.shutdown()
        logger.flush()
        loggerTransport.end()
    }, 20000)
  test('adds 1 + 2 to equal 3', () => {
    expect(1+ 2).toBe(3);
  });
});