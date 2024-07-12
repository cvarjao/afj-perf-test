import { LogLevel, BaseLogger } from '@credo-ts/core'
import * as ledgers from '../ledgers.json'
import pino from 'pino'
import * as lib from './lib'
import { PersonCredential1, PersonSchema1 } from './mocks'
import { CredentialDefinitionBuilder, ProofRequestBuilder, RequestAttributeBuilder, seconds_since_epoch } from './lib'
import { AgentTraction } from './AgentTraction'
import { AgentCredo } from './AgentCredo'
import { AriesAgent } from './Agent'
import { AgentManual } from './AgentManual'

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
const perf = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, base: {group: new Date().getTime()} }, pertTransport);

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

const logger = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, }, loggerTransport);

class PinoLogger extends BaseLogger {
    test(message: string, data?: Record<string, any> | undefined): void {
        logger.debug(data || {}, message)
    }
    trace(message: string, data?: Record<string, any> | undefined): void {
        logger.trace(data || {}, message)
    }
    debug(message: string, data?: Record<string, any> | undefined): void {
        logger.debug(data || {}, message, )
    }
    info(message: string, data?: Record<string, any> | undefined): void {
        logger.info(data || {}, message)
    }
    warn(message: string, data?: Record<string, any> | undefined): void {
        logger.warn(data || {}, message)
    }
    error(message: string, data?: Record<string, any> | undefined): void {
        logger.error(data || {}, message)
    }
    fatal(message: string, data?: Record<string, any> | undefined): void {
        //console.dir(data)
        logger.fatal(data || {}, message)
    }
    
}

const run = async () => {
    const config = require('../local.env.json')["sovrin_testnet"]
    const cycles = 1
    const steps = 1
    for (let cycle = 1; cycle <= cycles; cycle++) {
      console.log(`Starting cycle ${cycle}/${cycles}`)
      const agentA = new AgentTraction(config)
      //const agentB = new AgentCredo(config, ledgers, new PinoLogger(LogLevel.trace))
      const agentB: AriesAgent = new AgentManual(config, new PinoLogger(LogLevel.trace))
      await Promise.all([agentA.startup(), agentB.startup()])


      const ctx = new lib.Context(config)
      const schema = new PersonSchema1()
      const credDef = new CredentialDefinitionBuilder().setSchema(schema).setSupportRevocation(true)

      await agentA.createSchema(schema)
      await agentA.createSchemaCredDefinition(credDef)
      const issuer = agentA
      const holder: AriesAgent = agentB
      await agentA.clearAllRecords()
  
      for (let step = 1; step <= steps; step++) {
        console.log(`Starting step ${step}/${steps} of cycle ${cycle}/${cycles}`)
        
        /*
        const remoteInvitation = await agentA.createInvitationToConnect()
        const agentBConnectionRef = await holder.receiveInvitation(remoteInvitation)
        await issuer.waitForConnectionReady(remoteInvitation.connection_id)
        console.log(`${remoteInvitation.connection_id} connected to ${agentBConnectionRef.connection_id}`)
        console.dir(agentBConnectionRef)
        const personCred = new PersonCredential1()
        const credential_exchange_id = await issuer.sendCredential(personCred, credDef.getId() as string, remoteInvitation.connection_id)
        const offer = await holder.findCredentialOffer(agentBConnectionRef.connection_id)
        await holder.acceptCredentialOffer(offer)
        await issuer.waitForOfferAccepted(credential_exchange_id as string)
        */
        
        const proofRequest = new ProofRequestBuilder()
            .addRequestedAttribute("studentInfo",
                new RequestAttributeBuilder()
                    .setNames(["given_names", "family_name"])
                    .addRestriction({"cred_def_id": credDef.getId()})
                    .setNonRevoked(seconds_since_epoch(new Date()))
            )
        const remoteInvitation2 = await agentA.sendConnectionlessProofRequest(proofRequest)
        console.dir(['remoteInvitation2', remoteInvitation2], {depth: 5})
        const agentBConnectionRef2 = await holder.receiveInvitation(remoteInvitation2)
        await agentA.waitForPresentation(remoteInvitation2.presentation_exchange_id)
        
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
