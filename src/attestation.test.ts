import { describe, test } from "@jest/globals";
import { AgentTraction } from "./AgentTraction";
import { AgentCredo } from "./AgentCredo";
import { LogLevel } from "@credo-ts/core";
import { PersonCredential1, PersonSchemaV1_1 } from "./mocks";
import { CredentialDefinitionBuilder, issueCredential, PinoLogger, ProofRequestBuilder, RequestAttributeBuilder, SchemaBuilder, seconds_since_epoch, verifyCredentialA1, verifyCredentialA2, verifyCredentialB1, verifyCredentialB2, waitFor } from "./lib";
import pino from "pino";

const stepTimeout = 999999999
const shortTimeout = (2 * 60) * 1000

import { setGlobalDispatcher, Agent } from 'undici';
import { AriesAgent } from "./Agent";
import { AgentManual } from "./AgentManual";
setGlobalDispatcher(new Agent({ connect: { timeout: 20_000 } }));

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

describe("AppAttestation", () => {
  const _logger = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, }, loggerTransport);
  const logger = new PinoLogger(_logger, LogLevel.trace)
  const config = require("../local.env.json")["sovrin_testnet"];
  const ledgers = require("../ledgers.json");
  const agentA = new AgentTraction(config, logger);
  //const agentB: AriesAgent = new AgentManual(config, new ConsoleLogger(LogLevel.trace))
  const agentB: AriesAgent = process.env.HOLDER_TYPE === 'manual' ? new AgentManual(config, logger) : new AgentCredo(config, ledgers, logger)
  //new PinoLogger(logger, LogLevel.trace));
  const schema = new SchemaBuilder().setName('app_attestation').setVersion('1.0').setSchemaId('NXp6XcGeCR2MviWuY51Dva:2:app_attestation:1.0')
  const credDef = new CredentialDefinitionBuilder()
    .setId('NXp6XcGeCR2MviWuY51Dva:3:CL:33557:bcwallet_dev_v2')
    .setSchema(schema)
    .setSupportRevocation(true);

  beforeAll(async () => {
    logger.info('1 - beforeAll')
    await agentA.startup()
    await agentB.startup()
    //await Promise.all([agentA.startup(), agentB.startup()]);

  }, stepTimeout);
  afterAll(async () => {
    await agentB.shutdown();
  }, stepTimeout);
  test.skip("setup", async () => {
    logger.info('setup')

    try {
      await agentA.createSchema(schema);
      await agentA.createSchemaCredDefinition(credDef);
      await agentA.clearAllRecords()

      const personCred = new PersonCredential1(credDef)

      await issueCredential(agentA, agentB, personCred)
    } catch (error) {
      console.dir(error)
      throw error
    }
  }, stepTimeout)
  test("connected/v1", async () => {
    const verifier = agentA
    const holder = agentB
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const remoteInvitation = await verifier.createInvitationToConnect()
    logger.info(`waiting for holder to accept connection`)
    const agentBConnectionRef1 = await holder.receiveInvitation(remoteInvitation)
    logger.info(`waiting for issuer to accept connection`)
    await verifier.waitForConnectionReady(remoteInvitation.connection_id)
    logger.info(`${remoteInvitation.connection_id} connected to ${agentBConnectionRef1.connectionRecord?.connection_id}`)
    logger.info('agentBConnectionRef1', agentBConnectionRef1)

    const proofRequest = new ProofRequestBuilder()
      .addRequestedAttribute("attestationInfo",
        new RequestAttributeBuilder()
          .setNames([
            "operating_system_version",
            "validation_method",
            "app_id",
            "app_vendor",
            "issue_date_dateint",
            "operating_system",
            "app_version",
          ])
          .addRestriction({ "schema_name": schema.getName(), "schema_version": schema.getVersion(), "issuer_did": credDef.getId()?.split(':')[0] })
      )
    const proofRequestSent: any = await verifier.sendProofRequestV1(remoteInvitation.connection_id, proofRequest)
    logger.info('Proof Request Sent:', proofRequestSent)
    await verifier.waitForPresentation(proofRequestSent.presentation_exchange_id)
  }, shortTimeout);
});
