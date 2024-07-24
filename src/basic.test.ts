import { describe, test } from "@jest/globals";
import { AgentTraction } from "./AgentTraction";
import { AgentCredo } from "./AgentCredo";
import { LogLevel } from "@credo-ts/core";
import { PersonCredential1, PersonSchemaV1_1 } from "./mocks";
import { CredentialDefinitionBuilder, issueCredential, PinoLogger, ProofRequestBuilder, RequestAttributeBuilder, seconds_since_epoch, verifyCredentialA1, verifyCredentialA2, verifyCredentialB1, verifyCredentialB2, waitFor, withRedirectUrl } from "./lib";
import pino from "pino";

const stepTimeout = 120_000
const shortTimeout = (2*60)*1000

import { setGlobalDispatcher, Agent} from 'undici';
import { AriesAgent, ResponseCreateInvitationV1 } from "./Agent";
import { AgentManual } from "./AgentManual";
setGlobalDispatcher(new Agent({connect: { timeout: 20_000 }}));

export const loggerTransport = pino.transport({
  targets: [
    {
      level: 'trace',
      target: 'pino/file',
      options: {
        destination: `./logs/run-${Date.now()}.log.ndjson`,
        autoEnd: true,
      },
    }
  ],
})

describe("Mandatory", () => {
  const _logger = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, }, loggerTransport);
  const logger = new PinoLogger(_logger, LogLevel.trace)
  const config = require("../local.env.json")["sovrin_testnet"];
  const ledgers = require("../ledgers.json");
  const agentA = new AgentTraction(config, logger);
  //const agentB: AriesAgent = new AgentManual(config, new ConsoleLogger(LogLevel.trace))
  const agentB: AriesAgent =  process.env.HOLDER_TYPE === 'manual'? new AgentManual(config, logger): new AgentCredo(config,ledgers, logger)
  //new PinoLogger(logger, LogLevel.trace));
  const schema = new PersonSchemaV1_1();
  const credDef = new CredentialDefinitionBuilder()
    .setSchema(schema)
    .setSupportRevocation(true);
  
  beforeAll(async () => {
    logger.info('1 - beforeAll')
    await agentA.startup()
    await agentB.startup()
    //await Promise.all([agentA.startup(), agentB.startup()]);

  }, stepTimeout);
  afterAll(async () => {
    logger.info('1 - afterAll')
    await agentB.shutdown();
    _logger.flush();
    //loggerTransport.end();
  }, stepTimeout);
  test("connected/v1/M1", async () => {
    const issuer = agentA
    const holder = agentB
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const remoteInvitation = await issuer.createInvitationToConnect() as ResponseCreateInvitationV1
    logger.info(`waiting for holder to accept connection`)
    const agentBConnectionRef1 = await holder.receiveInvitation(remoteInvitation)
    logger.info(`waiting for issuer to accept connection`)
    await issuer.waitForConnectionReady(remoteInvitation.payload.connection_id as string)
    logger.info(`${remoteInvitation.payload.connection_id} connected to ${agentBConnectionRef1.connectionRecord?.connection_id}`)
    logger.info('agentBConnectionRef1', agentBConnectionRef1)
    const msgSent: any = await issuer.sendBasicMessage(remoteInvitation.payload.connection_id as string, 'Hello')
    logger.info('Message Sent:', msgSent)
    await waitFor(10_000)
    await holder.sendBasicMessage(agentBConnectionRef1.connectionRecord?.connection_id as string, 'ok')
    const msgRcvd = await issuer.waitForBasicMessage(remoteInvitation.payload.connection_id as string, Date.parse(msgSent.created_at as string), ["k", "ok"])
    logger.info('Message Received:', msgRcvd)
  }, shortTimeout);
  test.skip("OOB/connected/messaging", async () => {
    const issuer = agentA
    const holder = agentB
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const remoteInvitation = await issuer.createOOBInvitationToConnect()
    logger.info(`waiting for holder to accept connection`)
    const agentBConnectionRef1 = await holder.receiveInvitation(remoteInvitation)
    logger.info(`waiting for issuer to accept connection`)
    const {connection_id} =  await issuer.waitForOOBConnectionReady(remoteInvitation.payload.invi_msg_id)
    logger.info(`${connection_id} connected to ${agentBConnectionRef1.connectionRecord?.connection_id}`)
    logger.info('agentBConnectionRef1', agentBConnectionRef1)
    const msgSent: any = await issuer.sendBasicMessage(connection_id, 'Hello')
    logger.info('Message Sent:', msgSent)
    await waitFor(10_000)
    await holder.sendBasicMessage(agentBConnectionRef1.connectionRecord?.connection_id as string, 'ok')
    const msgRcvd = await issuer.waitForBasicMessage(connection_id, Date.parse(msgSent.created_at as string), ["k", "ok"])
    logger.info('Message Received:', msgRcvd)
  }, shortTimeout);
  test("setup", async () => {
    logger.info(`Executing ${expect.getState().currentTestName}`)

    try{
      await agentA.createSchema(schema);
      await agentA.createSchemaCredDefinition(credDef);
      await agentA.clearAllRecords()
      
      const personCred = new PersonCredential1(credDef)

      await issueCredential(agentA, agentB, personCred)
    }catch (error){
      console.dir(error)
      throw error
    }
  }, stepTimeout)
  test("connectionless/present-proof-1.0/encoded-payload", async () => {
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )
    await verifyCredentialA1(agentA, agentB, proofRequest)
  }, shortTimeout);
  test("connectionless/present-proof-1.0/url-redirect", async () => {
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )
    await verifyCredentialA2(agentA, agentB, proofRequest)
  }, shortTimeout);
  test("connectionless/present-proof-2.0/encoded-payload", async () => {
    const verifier = agentA
    const holder = agentB
    const { logger } = verifier
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )
    const remoteInvitation2 = await verifier.sendConnectionlessProofRequestV2(proofRequest)
    const agentBConnectionRef2 = await holder.receiveInvitation(remoteInvitation2)
    //console.dir(['agentBConnectionRef', agentBConnectionRef2])
    if (agentBConnectionRef2.invitationRequestsThreadIds){
      for (const proofId of agentBConnectionRef2.invitationRequestsThreadIds) {
        await holder.acceptProof({id: proofId})
      }
    }
    logger.info('remoteInvitation2', remoteInvitation2)
    await verifier.waitForPresentationV2(remoteInvitation2.payload.presentation_exchange_id as string)
  }, shortTimeout);
  test("connectionless/present-proof-2.0/url-redirect", async () => {
    const verifier = agentA
    const holder = agentB
    const { logger } = verifier
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )
    const remoteInvitation2 = await withRedirectUrl(await verifier.sendConnectionlessProofRequestV2(proofRequest))
    const agentBConnectionRef2 = await holder.receiveInvitation(remoteInvitation2)
    //console.dir(['agentBConnectionRef', agentBConnectionRef2])
    if (agentBConnectionRef2.invitationRequestsThreadIds){
      for (const proofId of agentBConnectionRef2.invitationRequestsThreadIds) {
        await holder.acceptProof({id: proofId})
      }
    }
    await verifier.waitForPresentationV2(remoteInvitation2.payload.presentation_exchange_id as string)
  }, shortTimeout);
  test("OOB/connectionless/present-proof-1.0/encoded-payload", async () => {
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )
    await verifyCredentialB1(agentA, agentB, proofRequest)
  }, shortTimeout);
  test("OOB/connectionless/present-proof-1.0/url-redirect", async () => {
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )
    await verifyCredentialB2(agentA, agentB, proofRequest)
  }, shortTimeout);
  test("OOB/connectionless/present-proof-2.0/encoded-payload", async () => {
    const verifier = agentA
    const holder = agentB
    const { logger } = verifier
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )

    const remoteInvitation3 = await verifier.sendOOBConnectionlessProofRequestV2(proofRequest)
    logger.info('remoteInvitation3', remoteInvitation3)
    logger.info(`Holder is receiving invitation for ${remoteInvitation3.payload.presentation_exchange_id}`)
    const agentBConnectionRef3 = await holder.receiveInvitation(remoteInvitation3)
    logger.info('Holder is accepting proofs')
    //await waitFor(10000)
    if (agentBConnectionRef3.invitationRequestsThreadIds){
      for (const proofId of agentBConnectionRef3.invitationRequestsThreadIds) {
        await holder.acceptProof({id: proofId})
      }
    }
    logger.info(`Verifier is waiting for proofs: ${remoteInvitation3.payload.presentation_exchange_id}`)
    await verifier.waitForPresentationV2(remoteInvitation3.payload.presentation_exchange_id  as string)
  }, shortTimeout);
  test("OOB/connectionless/present-proof-2.0/url-redirect", async () => {
    const verifier = agentA
    const holder = agentB
    const { logger } = verifier
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )

    const remoteInvitation3 = await withRedirectUrl(await verifier.sendOOBConnectionlessProofRequestV2(proofRequest))
    logger.info('remoteInvitation3', remoteInvitation3)
    logger.info(`Holder is receiving invitation for ${remoteInvitation3.payload.presentation_exchange_id}`)
    const agentBConnectionRef3 = await holder.receiveInvitation(remoteInvitation3)
    logger.info('Holder is accepting proofs')
    //await waitFor(10000)
    if (agentBConnectionRef3.invitationRequestsThreadIds){
      for (const proofId of agentBConnectionRef3.invitationRequestsThreadIds) {
        await holder.acceptProof({id: proofId})
      }
    }
    logger.info(`Verifier is waiting for proofs: ${remoteInvitation3.payload.presentation_exchange_id}`)
    await verifier.waitForPresentationV2(remoteInvitation3.payload.presentation_exchange_id as string)
  }, shortTimeout);
});
