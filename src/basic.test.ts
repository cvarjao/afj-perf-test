import { describe, test } from "@jest/globals";
import { AgentTraction } from "./AgentTraction";
import { AgentCredo } from "./AgentCredo";
import { LogLevel } from "@credo-ts/core";
import { PersonCredential1, PersonSchemaV1_1 } from "./mocks";
import { CredentialDefinitionBuilder, issueCredential, PinoLogger, ProofRequestBuilder, RequestAttributeBuilder, seconds_since_epoch, verifyCredentialA1, verifyCredentialA2, verifyCredentialB1, verifyCredentialB2, waitFor, withRedirectUrl } from "./lib";
import pino from "pino";

const stepTimeout = 120_000
const shortTimeout = 40_000
//import { dir as console_dir } from "console"
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config = require("../local.env.json")["sovrin_testnet"];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ledgers = require("../ledgers.json");
  const agentA = new AgentTraction(config, logger);
  //const agentB: AriesAgent = new AgentManual(config, new ConsoleLogger(LogLevel.trace))
  const agentB: AriesAgent =  process.env.HOLDER_TYPE === 'manual'? new AgentManual(config, logger): new AgentCredo(config,ledgers, logger)
  //new PinoLogger(logger, LogLevel.trace));
  const schema = new PersonSchemaV1_1();
  const credDef = new CredentialDefinitionBuilder()
    .setSchema(schema)
    .setSupportRevocation(true);
  const requests: unknown[] = []
  beforeAll(async () => {
    logger.info('1 - beforeAll')
    await agentA.startup()
    await agentB.startup()
    //await Promise.all([agentA.startup(), agentB.startup()]);
    agentA.axios.interceptors.request.use(request => {
      //take a copy
      const req = JSON.parse(JSON.stringify({
        headers:request.headers,
        data:request.data,
        params:request.params,
        baseUrl: '--redacted--', //request.baseURL,
        method: request.method,
        url: request.url
      }))
      if (req.headers['Authorization']) {
        req.headers['Authorization'] = '--redacted--'
      }
      if (req.url.startsWith('/connections/')){
        const regex = /^(\/connections\/)([^/]+)(\/[^/]+)?$/mg;
        req.url = req.url.replace(regex, '$1{connection_id}$3');
      }
      if (req.url.startsWith('/issue-credential/records/')){
        const regex = /^(\/issue-credential\/records\/)([^/]+)(\/[^/]+)?$/mg;
        req.url = req.url.replace(regex, '$1{record_id}$3');
      }
      if (req.url.startsWith('/present-proof/records/')){
        const regex = /^(\/present-proof\/records\/)([^/]+)(\/[^/]+)?$/mg;
        req.url = req.url.replace(regex, '$1{record_id}$3');
      }
      if (req.url.startsWith('/present-proof-2.0/records/')){
        const regex = /^(\/present-proof-2.0\/records\/)([^/]+)(\/[^/]+)?$/mg;
        req.url = req.url.replace(regex, '$1{record_id}$3');
      }
      if (req.url.startsWith('/credential-definitions/')){
        if (!(req.url === '/credential-definitions/created')){
          const regex = /^(\/credential-definitions\/)([^/]+)(\/[^/]+)?$/mg;
          req.url = req.url.replace(regex, '$1{cred_def_id}$3');
        }
      }
      if (req.method === 'get' && req.url === '/basicmessages' && req.params?.connection_id) {
        req.params.connection_id = '{connection_id}'
      }
      if (req.method === 'post' && req.url === '/present-proof/send-request' && req.data) {
        req.data.proof_request = '--redacted--'
        req.data.connection_id = '{connection_id}'
        req.data.cred_def_id = '{cred_def_id}'
      }
      if (req.method === 'post' && req.url === '/issue-credential/send-offer' && req.data) {
        req.data.credential_preview = '{--redacted--}'
        req.data.cred_def_id = '{cred_def_id}'
        req.data.connection_id = '{connection_id}'
      }
      if (req.method === 'post' && req.url === '/present-proof/create-request' && req.data) {
        req.data.proof_request = '{--redacted--}'
      }
      if (req.method === 'post' && req.url === '/out-of-band/create-invitation' && req.data?.attachments) {
        //req.data.attachments = '--redacted--'
        for (const attachment of req.data.attachments) {
          if (attachment?.id){
            attachment.id = '--redacted--'
          }
          if (attachment.data?.json){
            if (attachment?.data?.id){
              attachment.data.id = '--redacted--'
            }
            if (attachment?.data?.json?.id){
              attachment.data.json.id = '--redacted--'
            }
            if (attachment.data?.json?.thread_id) {
              attachment.data.json.thread_id = '--redacted--'
            }
            if (attachment.data?.json?.created_at){
              attachment.data.json.created_at = '--redacted--'
            }
            if (attachment.data?.json?.updated_at){
              attachment.data.json.updated_at = '--redacted--'
            }
            if (attachment.data?.json?.presentation_exchange_id) {
              attachment.data.json.presentation_exchange_id = '--redacted--'
            }
            if (attachment.data?.json?.pres_ex_id) {
              attachment.data.json.pres_ex_id = '--redacted--'
            }
            if (attachment.data?.json?.presentation_request) {
              attachment.data.json.presentation_request = '{--redacted--}'
            }
            if (attachment.data?.json?.presentation_request_dict) {
              attachment.data.json.presentation_request_dict = '{--redacted--}'
            }
            if (attachment.data?.json?.by_format?.pres_request?.indy) {
              attachment.data.json.by_format.pres_request.indy.nonce = '--redacted--'
              const requested_attributes = attachment.data?.json?.by_format.pres_request?.indy?.requested_attributes
              if (requested_attributes){
                for (const key in requested_attributes) {
                  if (Object.prototype.hasOwnProperty.call(requested_attributes, key)) {
                    const item = requested_attributes[key];
                    if (item.non_revoked?.from) {
                      item.non_revoked.from = '--redacted--'
                    }
                    if (item.non_revoked?.to) {
                      item.non_revoked.to = '--redacted--'
                    }
                    if (item.restrictions) {
                      for (const restriction of item.restrictions) {
                        if (restriction.issuer_did) {
                          restriction.issuer_did = '--redacted--'
                        }
                      }
                    }
                  }
                }
              }
            }
            if (attachment.data?.json?.pres_request) {
              attachment.data.json.pres_request = '{--redacted--}'
            }
          }
        }
      }
      if (req.method === 'post' && req.url === '/present-proof-2.0/create-request' && req.data) {
        req.data.presentation_request = '{--redacted--}'
      }
      if (req.method === 'post' && req.url === '/connections/{connection_id}' && req.data?.my_label) {
        const regex = /(- \d+$)/mg;
        req.data.my_label = req.data.my_label.replace(regex, '- {timestamp}');
      }
      // do not add consecutive duplicates
      if (requests.length > 0) {
        const prev = requests[requests.length - 1]
        if (JSON.stringify(prev) === JSON.stringify(req)) {
          //console_dir(request, {depth: 6})
          return request
        }
      }
      //console_dir(req, {depth: 6})
      requests.push(req)
      return request
    })
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
    await holder.sendBasicMessage(agentBConnectionRef1.connectionRecord?.connection_id as string, 'ok')
    const msgRcvd = await issuer.waitForBasicMessage(remoteInvitation.payload.connection_id as string, Date.parse(msgSent.created_at as string), ["k", "ok"])
    logger.info('Message Received:', msgRcvd)
    expect(requests).toMatchSnapshot(); //([{data: {my_label: expect.any(String)}}])
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
    expect(requests).toMatchSnapshot();
  }, stepTimeout)
  test("connected/present-proof-1.0/encoded-payload", async () => {
    //const issuer = agentA
    const verifier = agentA
    const holder = agentB
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const remoteInvitation = await verifier.createInvitationToConnect() as ResponseCreateInvitationV1
    logger.info(`waiting for holder to accept connection`)
    const agentBConnectionRef1 = await holder.receiveInvitation(remoteInvitation)
    logger.info(`waiting for issuer to accept connection`)
    await verifier.waitForConnectionReady(remoteInvitation.payload.connection_id as string)
    logger.info(`${remoteInvitation.payload.connection_id} connected to ${agentBConnectionRef1.connectionRecord?.connection_id}`)
    logger.info('agentBConnectionRef1', agentBConnectionRef1)
    const proofRequest = new ProofRequestBuilder()
        .addRequestedAttribute("studentInfo",
            new RequestAttributeBuilder()
                .setNames(["given_names", "family_name"])
                //.addRestriction({"cred_def_id": credDef.getId()})
                .addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
                .setNonRevoked(seconds_since_epoch(new Date()))
    )
    const proofRequestSent = await verifier.sendProofRequestV1(remoteInvitation.payload.connection_id as string, proofRequest)
    holder.acceptProof({connection_id:agentBConnectionRef1.connectionRecord?.connection_id as string})
    await verifier.waitForPresentation(proofRequestSent.presentation_exchange_id)
    expect(requests).toMatchSnapshot();
  }, shortTimeout);
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
    expect(requests).toMatchSnapshot();
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
    expect(requests).toMatchSnapshot();
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
    expect(requests).toMatchSnapshot();
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
    expect(requests).toMatchSnapshot();
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
    expect(requests).toMatchSnapshot();
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
    expect(requests).toMatchSnapshot();
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
    expect(requests).toMatchSnapshot();
  }, shortTimeout);
});
