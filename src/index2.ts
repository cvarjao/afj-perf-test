import { LogLevel, BaseLogger } from '@credo-ts/core'
//import * as ledgers from '../ledgers.json'
import pino, { Logger } from 'pino'
import * as lib from './lib'
import { PersonCredential1, PersonSchema1 } from './mocks'
import { CredentialDefinitionBuilder, issueCredential, PinoLogger, ProofRequestBuilder, RequestAttributeBuilder, seconds_since_epoch, verifyCredentialA2 } from './lib'
import { AgentTraction } from './AgentTraction'
import { AgentCredo } from './AgentCredo'
import { AriesAgent } from './Agent'
import { AgentManual } from './AgentManual'
import fs from 'node:fs';
import path from 'node:path';

import ledgers from '../ledgers.json'
import axios from 'axios'

const pertTransport = pino.transport({
  targets: [
    {
      level: 'trace',
      target: 'pino/file',
      options: {
        destination: './log.perf.ndjson',
        autoEnd: true,
      },
    }
  ],
})

export const loggerTransport = pino.transport({
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

const logger = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, }, loggerTransport);




const run = async () => {
    const config = require('../local.env.json')["sovrin_testnet"]
    const cycles = 1
    const steps = 1
    for (let cycle = 1; cycle <= cycles; cycle++) {
      console.log(`Starting cycle ${cycle}/${cycles}`)
      const agentA = new AgentTraction(config)
      const agentB = new AgentCredo(config, ledgers, new PinoLogger(logger, LogLevel.trace))
      //const agentB: AriesAgent = new AgentManual(config, new PinoLogger(logger, LogLevel.trace))
      await Promise.all([agentA.startup(), agentB.startup()])


      const schema = new PersonSchema1()
      const credDef = new CredentialDefinitionBuilder().setSchema(schema).setSupportRevocation(true).setTag('revocable2')

      await agentA.createSchema(schema)
      await agentA.createSchemaCredDefinition(credDef) 
      await agentA.clearAllRecords()
      

      for (let step = 1; step <= steps; step++) {
        console.log(`Starting step ${step}/${steps} of cycle ${cycle}/${cycles}`)
        const personCred = new PersonCredential1(credDef)
        
        const proofRequest = new ProofRequestBuilder()
            .addRequestedAttribute("studentInfo",
                new RequestAttributeBuilder()
                    .setNames(["given_names", "family_name"])
                    //.addRestriction({"cred_def_id": credDef.getId()})
                    .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                    .setNonRevoked(seconds_since_epoch(new Date()))
        )

        await issueCredential(agentA, agentB, personCred)

        // Connectionless Proof Request
        //await verifyCredentialA1(agentA, agentB, proofRequest)
        await verifyCredentialA2(agentA, agentB, proofRequest)

        // OOB Connectionless Proof Request
        //await verifyCredentialB1(agentA, agentB, proofRequest)
        //await verifyCredentialB2(agentA, agentB, proofRequest)
        
      }
    }
    
    //agent.events.on()
    pertTransport.unref()
    pertTransport.flushSync(); pertTransport.end();
    loggerTransport.unref()
    loggerTransport.flushSync(); loggerTransport.end();
    //console.dir(performance.getEntries(), {depth: 6})
    console.log('DONE')
    process.exit()
}

run()
