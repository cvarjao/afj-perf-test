import { describe, expect, test } from "@jest/globals";
import { AgentTraction } from "./AgentTraction";
import { AgentCredo } from "./AgentCredo";
import { ConsoleLogger, Logger, LogLevel } from "@credo-ts/core";
import { PersonCredential1, PersonSchema1 } from "./mocks";
import { CredentialDefinitionBuilder, issueCredential, ProofRequestBuilder, RequestAttributeBuilder, seconds_since_epoch, verifyCredentialA1, verifyCredentialA2 } from "./lib";

describe.skip("Connectionless", () => {
  const config = require("../local.env.json")["sovrin_testnet"];
  const ledgers = require("../ledgers.json");
  //const agentA = new AgentTraction(config);
  const agentB = new AgentCredo(
    config,
    ledgers,
    new ConsoleLogger(LogLevel.trace)//new PinoLogger(logger, LogLevel.trace)
  );
  const schema = new PersonSchema1();
  const credDef = new CredentialDefinitionBuilder()
    .setSchema(schema)
    .setSupportRevocation(true);
  
  beforeAll(async () => {
    console.log('1 - beforeAll')
    //await agentA.startup()
    await agentB.startup()
    //await Promise.all([agentA.startup(), agentB.startup()]);
    //await agentA.createSchema(schema);
    //await agentA.createSchemaCredDefinition(credDef);
    //await agentA.clearAllRecords()
    
    const personCred = new PersonCredential1(credDef)

    //await issueCredential(agentA, agentB, personCred)
  }, 20000);
  afterAll(async () => {
    console.log('1 - afterAll')
    await agentB.shutdown();
    //logger.flush();
    //loggerTransport.end();
  }, 20000);
  test("connection/v1/A", async () => {
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )
    //await verifyCredentialA1(agentA, agentB, proofRequest)
  }, 20000);
});
