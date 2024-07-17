import { describe, expect, test } from "@jest/globals";
import { AgentTraction } from "./AgentTraction";
import { AgentCredo } from "./AgentCredo";
import { ConsoleLogger, Logger, LogLevel } from "@credo-ts/core";
import { PersonCredential1, PersonSchema1 } from "./mocks";
import { CredentialDefinitionBuilder, issueCredential, PinoLogger, ProofRequestBuilder, RequestAttributeBuilder, seconds_since_epoch, verifyCredentialA1, verifyCredentialA2, verifyCredentialB1, verifyCredentialB2 } from "./lib";
import { AgentManual } from "./AgentManual";
import { AriesAgent } from "./Agent";
import { log, error } from "console";
import pino from "pino";

const stepTimeout = 999999999
const shortTimeout = (2*60)*1000

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

describe("Connectionless", () => {
  const logger = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, }, loggerTransport);
  const config = require("../local.env.json")["sovrin_testnet"];
  const ledgers = require("../ledgers.json");
  const agentA = new AgentTraction(config);
  //const agentB: AriesAgent = new AgentManual(config, new ConsoleLogger(LogLevel.trace))
  const agentB = new AgentCredo(config,ledgers,new PinoLogger(logger, LogLevel.trace))
  //new PinoLogger(logger, LogLevel.trace));
  const schema = new PersonSchema1();
  const credDef = new CredentialDefinitionBuilder()
    .setSchema(schema)
    .setSupportRevocation(true);
  
  beforeAll(async () => {
    log('1 - beforeAll')
    await agentA.startup()
    await agentB.startup()
    //await Promise.all([agentA.startup(), agentB.startup()]);

  }, stepTimeout);
  afterAll(async () => {
    log('1 - afterAll')
    await agentB.shutdown();
    //logger.flush();
    //loggerTransport.end();
  }, stepTimeout);
  test.only("setup", async () => {
    log('setup')
    await agentA.createSchema(schema);
    await agentA.createSchemaCredDefinition(credDef);
    await agentA.clearAllRecords()
    
    const personCred = new PersonCredential1(credDef)

    await issueCredential(agentA, agentB, personCred)
  }, stepTimeout)
  test.only("connection/v1/A1", async () => {
    log('connection/v1/A1')
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
  test("connection/v1/A2", async () => {
    log("connection/v1/A2")
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
  test("connection/OOB/B1", async () => {
    log("connection/OOB/B1")
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
  test("connection/OOB/B2", async () => {
    log("connection/OOB/B2")
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
});
