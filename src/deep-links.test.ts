import { describe, test } from "@jest/globals";
import { AgentTraction } from "./AgentTraction";
import { AgentCredo } from "./AgentCredo";
import { LogLevel } from "@credo-ts/core";
import { PersonSchemaV1_1 } from "./mocks";
import { CredentialDefinitionBuilder, PinoLogger, withDeepLinkPage, withRedirectUrl } from "./lib";
import pino from "pino";

const stepTimeout = 120_000
const shortTimeout = 40_000
import { dir as console_dir } from "console"
import { setGlobalDispatcher, Agent} from 'undici';
import { AriesAgent, INVITATION_TYPE } from "./Agent";
import { AgentManual } from "./AgentManual";
import { cache_requests } from "./axios-traction-serializer";
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

describe("deep-links", () => {
  const _logger = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, }, loggerTransport);
  const logger = new PinoLogger(_logger, LogLevel.trace)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config = require("../local.env.json")
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ledgers = require("../ledgers.json");
  const agentSchemaOwner = new AgentTraction(config.schema_owner, logger);
  const agentIssuer = new AgentTraction(config.issuer, logger);
  const agentVerifier = new AgentTraction(config.verifier, logger);
  //const agentB: AriesAgent = new AgentManual(config, new ConsoleLogger(LogLevel.trace))
  const agentB: AriesAgent =  process.env.HOLDER_TYPE === 'manual'? new AgentManual(config.holder, logger): new AgentCredo(config.holder,ledgers, logger)
  //new PinoLogger(logger, LogLevel.trace));
  const schema = new PersonSchemaV1_1();
  const credDef = new CredentialDefinitionBuilder()
    .setSchema(schema)
    .setSupportRevocation(true)
    .setTag('Revocable Credential')
  const requests: unknown[] = []
  beforeAll(async () => {
    logger.info('1 - beforeAll')
    await agentSchemaOwner.startup()
    await agentIssuer.startup()
    await agentB.startup()
    await agentVerifier.startup()
    //await Promise.all([agentA.startup(), agentB.startup()]);
    agentSchemaOwner.axios.interceptors.request.use(cache_requests(requests))
    agentIssuer.axios.interceptors.request.use(cache_requests(requests))
    agentVerifier.axios.interceptors.request.use(cache_requests(requests))
    agentIssuer.axios.interceptors.response.use( async (response) => {
      return response
    }, (error) => {
      console_dir(error.response)
      return Promise.reject(error);
    })

    await agentSchemaOwner.createSchema(schema);
    await agentIssuer.createSchemaCredDefinition(credDef);
  }, stepTimeout);
  afterAll(async () => {
    logger.info('1 - afterAll')
    await agentB.shutdown();
    _logger.flush();
    //loggerTransport.end();
  }, stepTimeout);
  beforeEach(async () => {
    requests.length = 0
  })
  test("OOB/connected/messaging", async () => {
    const issuer = agentIssuer
    const holder = agentB
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const remoteInvitation = await withDeepLinkPage(await withRedirectUrl(await issuer.createInvitationToConnect(INVITATION_TYPE.OOB_DIDX_1_1)))
    logger.info(`waiting for holder to accept connection`)
    const agentBConnectionRef1 = await holder.receiveInvitation(remoteInvitation)
    logger.info(`waiting for issuer to accept connection`)
    const {connection_id} =  await issuer.waitForOOBConnectionReady(remoteInvitation.payload.invi_msg_id)
    logger.info(`${connection_id} connected to ${agentBConnectionRef1.connectionRecord?.connection_id}`)
    logger.info('agentBConnectionRef1', agentBConnectionRef1)
    const msgSent: any = await issuer.sendBasicMessage(connection_id, 'Hello')
    logger.info('Message Sent:', msgSent)
    await holder.sendBasicMessage(agentBConnectionRef1.connectionRecord?.connection_id as string, 'ok')
    const msgRcvd = await issuer.waitForBasicMessage(connection_id, Date.parse(msgSent.created_at as string), ["k", "ok"])
    logger.info('Message Received:', msgRcvd)
  }, stepTimeout);
});
