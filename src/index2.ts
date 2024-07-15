import { LogLevel, BaseLogger } from '@credo-ts/core'
//import * as ledgers from '../ledgers.json'
import pino, { Logger } from 'pino'
import * as lib from './lib'
import { PersonCredential1, PersonSchema1 } from './mocks'
import { CredentialDefinitionBuilder, ProofRequestBuilder, RequestAttributeBuilder, seconds_since_epoch } from './lib'
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

export class PinoLogger extends BaseLogger {
  logger: Logger
   constructor(logger:Logger, logLevel:LogLevel){
    super(logLevel)
    this.logger= logger
   }
    test(message: string, data?: Record<string, any> | undefined): void {
        this.logger.debug(data || {}, message)
    }
    trace(message: string, data?: Record<string, any> | undefined): void {
        this.logger.trace(data || {}, message)
    }
    debug(message: string, data?: Record<string, any> | undefined): void {
        this.logger.debug(data || {}, message, )
    }
    info(message: string, data?: Record<string, any> | undefined): void {
        this.logger.info(data || {}, message)
    }
    warn(message: string, data?: Record<string, any> | undefined): void {
        this.logger.warn(data || {}, message)
    }
    error(message: string, data?: Record<string, any> | undefined): void {
        this.logger.error(data || {}, message)
    }
    fatal(message: string, data?: Record<string, any> | undefined): void {
        //console.dir(data)
        this.logger.fatal(data || {}, message)
    }
    
}

export const issueCredential = async (issuer:AgentTraction, holder: AriesAgent, cred: PersonCredential1)  => {
  const remoteInvitation = await issuer.createInvitationToConnect()
  console.log(`waiting for holder to accept connection`)
  const agentBConnectionRef1 = await holder.receiveInvitation(remoteInvitation)
  console.log(`waiting for issuer to accept connection`)
  await issuer.waitForConnectionReady(remoteInvitation.connection_id)
  console.log(`${remoteInvitation.connection_id} connected to ${agentBConnectionRef1.connectionRecord?.connection_id}`)
  console.dir(agentBConnectionRef1)
  const credential_exchange_id = await issuer.sendCredential(cred, cred.getCredDef()?.getId() as string, remoteInvitation.connection_id)
  const offer = await holder.findCredentialOffer(agentBConnectionRef1.connectionRecord?.connection_id as string)
  await holder.acceptCredentialOffer(offer)
  await issuer.waitForOfferAccepted(credential_exchange_id as string)
}

/**
 * Connectionless (Connection/v1)
 */
const verifyCredentialA1 = async (verifier:AriesAgent, holder: AriesAgent, proofRequest: ProofRequestBuilder)  => {
  const remoteInvitation2 = await verifier.sendConnectionlessProofRequest(proofRequest)
  const agentBConnectionRef2 = await holder.receiveInvitation(remoteInvitation2)
  //console.dir(['agentBConnectionRef', agentBConnectionRef2])
  if (agentBConnectionRef2.invitationRequestsThreadIds){
    for (const proofId of agentBConnectionRef2.invitationRequestsThreadIds) {
      await holder.acceptProof({id: proofId})
    }
  }
  await verifier.waitForPresentation(remoteInvitation2.presentation_exchange_id)
}
const verifyCredentialA2 = async (verifier:AriesAgent, holder: AriesAgent, proofRequest: ProofRequestBuilder)  => {
  const remoteInvitation2 = await verifier.sendConnectionlessProofRequest(proofRequest)
  const invitationFile = `${remoteInvitation2.invitation['@id']}.json`
  fs.writeFileSync(path.join(process.cwd(), `/tmp/${invitationFile}`), JSON.stringify(remoteInvitation2.invitation, undefined, 2))
  const publicUrl = await axios.get('http://127.0.0.1:4040/api/tunnels').then((response)=>{return response.data.tunnels[0].public_url as string})
  const agentBConnectionRef2 = await holder.receiveInvitation({invitation_url: `${publicUrl}/${invitationFile}`, connection_id: ''})
  //console.dir(['agentBConnectionRef', agentBConnectionRef2])
  if (agentBConnectionRef2.invitationRequestsThreadIds){
    for (const proofId of agentBConnectionRef2.invitationRequestsThreadIds) {
      await holder.acceptProof({id: proofId})
    }
  }
  await verifier.waitForPresentation(remoteInvitation2.presentation_exchange_id)
}
/**
 * Connectionless (OOB)
 */
const verifyCredentialB1 = async (verifier:AriesAgent, holder: AriesAgent, proofRequest: ProofRequestBuilder)  => {
  const remoteInvitation3 = await verifier.sendOOBConnectionlessProofRequest(proofRequest)
  console.dir(['remoteInvitation3', remoteInvitation3], {depth: 5})
  console.log('Holder is receiving invitation')
  const agentBConnectionRef3 =await holder.receiveInvitation(remoteInvitation3)
  console.log('Holder is accepting proofs')
  if (agentBConnectionRef3.invitationRequestsThreadIds){
    for (const proofId of agentBConnectionRef3.invitationRequestsThreadIds) {
      await holder.acceptProof({id: proofId})
    }
  }
  console.log('Verifier is waiting for proofs')
  await verifier.waitForPresentation(remoteInvitation3.presentation_exchange_id)
}

const run = async () => {
    const config = require('../local.env.json')["sovrin_testnet"]
    const cycles = 1
    const steps = 1
    for (let cycle = 1; cycle <= cycles; cycle++) {
      console.log(`Starting cycle ${cycle}/${cycles}`)
      const agentA = new AgentTraction(config)
      const agentB = new AgentCredo(config, ledgers, new PinoLogger(logger, LogLevel.trace))
      //const agentB: AriesAgent = new AgentManual(config, new PinoLogger(LogLevel.trace))
      await Promise.all([agentA.startup(), agentB.startup()])


      const schema = new PersonSchema1()
      const credDef = new CredentialDefinitionBuilder().setSchema(schema).setSupportRevocation(true)

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
        //await verifyCredentialA2(agentA, agentB, proofRequest)

        // OOB Connectionless Proof Request
        await verifyCredentialB1(agentA, agentB, proofRequest)
        
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
