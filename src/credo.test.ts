import { describe, expect, test } from "@jest/globals";
import { LogLevel, WsOutboundTransport } from "@credo-ts/core";
import { AgentTraction } from "./AgentTraction";
import { AgentCredo } from "./AgentCredo";
import {PinoLogger } from "./lib";
import pino from "pino";
import { INVITATION_TYPE } from "./Agent";

// type AgentType = Awaited<ReturnType<typeof createAgent>>

const delay = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const loggerTransport = pino.transport({
  targets: [
    {
      level: 'trace',
      target: 'pino/file',
      options: {
        destination: `./logs/run.log.ndjson`,
        autoEnd: true,
      },
    }
  ],
})

describe("credo", () => {
  const _logger = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, }, loggerTransport);
  const logger = new PinoLogger(_logger, LogLevel.trace)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ledgers = require("../ledgers.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config = require("../local.env.json");
  let holderAgent: AgentCredo;
  let issuerAgent: AgentTraction;

  beforeAll(async () => {
    console.log('beforeAll')
    holderAgent = new AgentCredo(config.holderX, ledgers, logger); 
    issuerAgent = new AgentTraction(config.issuer, logger);

    await holderAgent.startup()
    await issuerAgent.startup()
  }, 50000);
  
  afterAll(async () => {
    console.log('afterAll')

    await holderAgent.shutdown()
    await issuerAgent.shutdown()
  }, 20000);
  
  test("something", async () => {
    expect(1 + 2).toBe(3);
  }, 20000);

  test("receive basic messages", async () => {
    const messageCount = 2
    const remoteInvitation = await issuerAgent.createInvitationToConnect(INVITATION_TYPE.CONN_1_0)
    const issuerAgentConnectionRef = await holderAgent.receiveInvitation(remoteInvitation)
    
    logger.info(`waiting for issuer to issuerAgent connection`)
    await issuerAgent.waitForConnectionReady(remoteInvitation.payload.connection_id as string)

    logger.info(`${remoteInvitation.payload.connection_id} connected to ${issuerAgentConnectionRef.connectionRecord?.connection_id}`)
   
    // await holderAgent.shutdown()

    const messageReceivedPromise = new Promise<number>((resolve) => {
      let callCount = 0;
      holderAgent.onBasicMessageReceived = (message) => {
        console.log('basic message received:', message.content);
        callCount++;
        if (callCount === messageCount) {
          resolve(callCount);
        }
      };
    });

    await holderAgent.agent.mediationRecipient.stopMessagePickup();
    
    logger.info(`waiting for 20 seconds`)
    await delay(20000); // Pause for 20 seconds

    // await holderAgent.agent.outboundTransports[0].stop();
    // await holderAgent.agent.mediationRecipient.stopMessagePickup();

    logger.info(`sending ${messageCount} basic message(s) to ${remoteInvitation.payload.connection_id}`)

    await issuerAgent.sendBasicMessage(remoteInvitation.payload.connection_id as string, 'Hello from issuer 1')
    await issuerAgent.sendBasicMessage(remoteInvitation.payload.connection_id as string, 'Hello from issuer 2')

    await delay(5000); 

    await holderAgent.agent.mediationRecipient.initiateMessagePickup();
    // await holderAgent.agent.outboundTransports[0].start(holderAgent.agent)
    // await holderAgent.agent.mediationRecipient.initiateMessagePickup();

    expect(await messageReceivedPromise).toBe(messageCount);  
  }, 35000);
});
