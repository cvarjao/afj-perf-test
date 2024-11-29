import { describe, test } from "@jest/globals";
import { AgentTraction } from "./AgentTraction";
import { AgentCredo } from "./AgentCredo";
import { LogLevel } from "@credo-ts/core";
import { PersonCredential1, PersonSchemaV1_1 } from "./mocks";
import {
  CredentialDefinitionBuilder,
  issueCredential,
  PinoLogger,
  ProofRequestBuilder,
  RequestAttributeBuilder,
  seconds_since_epoch,
  verifyCredentialA1,
  verifyCredentialA2,
  verifyCredentialB1,
  verifyCredentialB2,
  withRedirectUrl,
  writeQRCode,
} from "./lib";
import pino from "pino";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";

const stepTimeout = 120_000;
const shortTimeout = 40_000;
import { dir as console_dir } from "console";
import { setGlobalDispatcher, Agent } from "undici";
import { AriesAgent, INVITATION_TYPE } from "./Agent";
import { AgentManual } from "./AgentManual";
import { cache_requests } from "./axios-traction-serializer";
setGlobalDispatcher(new Agent({ connect: { timeout: 20_000 } }));

export const loggerTransport = pino.transport({
  targets: [
    {
      level: "trace",
      target: "pino/file",
      options: {
        destination: `./logs/run-${Date.now()}.log.ndjson`,
        autoEnd: true,
      },
    },
  ],
});

describe("Mandatory", () => {
  const _logger = pino(
    { level: "trace", timestamp: pino.stdTimeFunctions.isoTime },
    loggerTransport
  );
  const logger = new PinoLogger(_logger, LogLevel.trace);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config = require("../local.env.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ledgers = require("../ledgers.json");
  const agentSchemaOwner = new AgentTraction(config.schema_owner, logger);
  const agentIssuer = new AgentTraction(config.issuer, logger);
  const agentVerifier = new AgentTraction(config.verifier, logger);
  //const agentB: AriesAgent = new AgentManual(config, new ConsoleLogger(LogLevel.trace))
  const agentB: AriesAgent =
    process.env.HOLDER_TYPE === "manual"
      ? new AgentManual(config.holder, logger)
      : new AgentCredo(config.holder, ledgers, logger);
  //new PinoLogger(logger, LogLevel.trace));
  const schema = new PersonSchemaV1_1();
  const credDef = new CredentialDefinitionBuilder()
    .setSchema(schema)
    .setSupportRevocation(true)
    .setTag("Revocable Credential");
  const requests: unknown[] = [];
  beforeAll(async () => {
    logger.info("1 - beforeAll");
    await agentSchemaOwner.startup();
    await agentIssuer.startup();
    await agentB.startup();
    await agentVerifier.startup();
    //await Promise.all([agentA.startup(), agentB.startup()]);
    agentSchemaOwner.axios.interceptors.request.use(cache_requests(requests));
    agentIssuer.axios.interceptors.request.use(cache_requests(requests));
    agentVerifier.axios.interceptors.request.use(cache_requests(requests));
    agentIssuer.axios.interceptors.response.use(
      async (response) => {
        return response;
      },
      (error) => {
        console_dir(error.response);
        return Promise.reject(error);
      }
    );

    await agentSchemaOwner.createSchema(schema);
    await agentIssuer.createSchemaCredDefinition(credDef);
  }, stepTimeout);
  afterAll(async () => {
    logger.info("1 - afterAll");
    await agentB.shutdown();
    _logger.flush();
    //loggerTransport.end();
  }, stepTimeout);
  beforeEach(async () => {
    requests.length = 0
  })
  test.skip("connected/v1/M1", async () => {
    const issuer = agentIssuer
    const holder = agentB
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const remoteInvitation = await issuer.createInvitationToConnect(INVITATION_TYPE.CONN_1_0)
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
    //expect(requests).toMatchSnapshot();
  }, shortTimeout);
  test("OOB/connected/messaging", async () => {
    const issuer = agentIssuer
    const holder = agentB
    logger.info(`Executing ${expect.getState().currentTestName}`)
    const remoteInvitation = await issuer.createInvitationToConnect(INVITATION_TYPE.OOB_DIDX_1_1)
    logger.info(`waiting for holder to accept connection`)
    const agentBConnectionRef1 = await holder.receiveInvitation(remoteInvitation)
    logger.info(`waiting for issuer to accept connection`)
    const {connection_id} =  await issuer.waitFoConnectionReady(remoteInvitation)
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

      try {
        await agentIssuer.clearAllRecords();

        const personCred = new PersonCredential1(credDef);

        await issueCredential(agentIssuer, agentB, personCred);
      } catch (error) {
        console.dir(error);
        throw error;
      }
      //expect(requests).toMatchSnapshot();
    },
    stepTimeout
  );
  test(
    "OOB/connected/issue",
    async () => {
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const issuer = agentIssuer;
      const holder = agentB;
      const cred = new PersonCredential1(credDef);
      const remoteInvitation = await issuer.createOOBInvitationToConnect(
        INVITATION_TYPE.OOB_CONN_1_0
      );
      logger.info("remoteInvitation", remoteInvitation);
      logger.info(`waiting for holder to accept connection`);
      const agentBConnectionRef1 = await holder.receiveInvitation(
        remoteInvitation
      );
      logger.info(`waiting for issuer to accept connection`);
      const { connection_id } = await issuer.waitForOOBConnectionReady(
        remoteInvitation.payload.invi_msg_id
      );
      logger.info("agentBConnectionRef1", agentBConnectionRef1);
      await issuer.sendBasicMessage(connection_id, "Hello");
      const credential_exchange_id = await issuer.sendCredential(
        cred,
        cred.getCredDef()?.getId() as string,
        connection_id
      );
      const offer = await holder.findCredentialOffer(
        agentBConnectionRef1.connectionRecord?.connection_id as string
      );
      await holder.acceptCredentialOffer(offer);
      await issuer.waitForOfferAccepted(credential_exchange_id as string);
    },
    shortTimeout
  );
  test(
    "connected/present-proof-1.0/encoded-payload",
    async () => {
      //const issuer = agentA
      const verifier = agentVerifier;
      const holder = agentB;
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const remoteInvitation = await verifier.createInvitationToConnect(
        INVITATION_TYPE.CONN_1_0
      );
      logger.info(`waiting for holder to accept connection`);
      const agentBConnectionRef1 = await holder.receiveInvitation(
        remoteInvitation
      );
      logger.info(`waiting for issuer to accept connection`);
      await verifier.waitForConnectionReady(
        remoteInvitation.payload.connection_id as string
      );
      logger.info(
        `${remoteInvitation.payload.connection_id} connected to ${agentBConnectionRef1.connectionRecord?.connection_id}`
      );
      logger.info("agentBConnectionRef1", agentBConnectionRef1);
      const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
        "studentInfo",
        new RequestAttributeBuilder()
          .setNames(["given_names", "family_name"])
          //.addRestriction({"cred_def_id": credDef.getId()})
          .addRestriction({
            schema_name: schema.getName(),
            schema_version: schema.getVersion(),
            issuer_did: credDef.getId()?.split(":")[0],
          })
          .setNonRevoked(seconds_since_epoch(new Date()))
      );
      const proofRequestSent = await verifier.sendProofRequestV1(
        remoteInvitation.payload.connection_id as string,
        proofRequest
      );
      holder.acceptProof({
        connection_id: agentBConnectionRef1.connectionRecord
          ?.connection_id as string,
      });
      await verifier.waitForPresentation(
        proofRequestSent.presentation_exchange_id
      );
      //expect(requests).toMatchSnapshot();
    },
    shortTimeout
  );
  test(
    "connectionless/present-proof-1.0/encoded-payload",
    async () => {
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
        "studentInfo",
        new RequestAttributeBuilder()
          .setNames(["given_names", "family_name"])
          .addRestriction({ cred_def_id: credDef.getId() })
          //.addRestriction({"schema_name": schema.getName(),"schema_version": schema.getVersion(),"issuer_did": credDef.getId()?.split(':')[0]})
          .setNonRevoked(seconds_since_epoch(new Date()))
      );
      await verifyCredentialA1(agentVerifier, agentB, proofRequest);
      //expect(requests).toMatchSnapshot();
    },
    shortTimeout
  );
  test(
    "connectionless/present-proof-1.0/url-redirect",
    async () => {
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
        "studentInfo",
        new RequestAttributeBuilder()
          .setNames(["given_names", "family_name"])
          //.addRestriction({"cred_def_id": credDef.getId()})
          .addRestriction({
            schema_name: schema.getName(),
            schema_version: schema.getVersion(),
            issuer_did: credDef.getId()?.split(":")[0],
          })
          .setNonRevoked(seconds_since_epoch(new Date()))
      );
      await verifyCredentialA2(agentVerifier, agentB, proofRequest);
      //expect(requests).toMatchSnapshot();
    },
    shortTimeout
  );
  test(
    "connectionless/present-proof-2.0/encoded-payload",
    async () => {
      const verifier = agentVerifier;
      const holder = agentB;
      const { logger } = verifier;
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
        "studentInfo",
        new RequestAttributeBuilder()
          .setNames(["given_names", "family_name"])
          //.addRestriction({"cred_def_id": credDef.getId()})
          .addRestriction({
            schema_name: schema.getName(),
            schema_version: schema.getVersion(),
            issuer_did: credDef.getId()?.split(":")[0],
          })
          .setNonRevoked(seconds_since_epoch(new Date()))
      );
      const remoteInvitation2 = await verifier.sendConnectionlessProofRequestV2(
        proofRequest
      );
      const agentBConnectionRef2 = await holder.receiveInvitation(
        remoteInvitation2
      );
      //console.dir(['agentBConnectionRef', agentBConnectionRef2])
      if (agentBConnectionRef2.invitationRequestsThreadIds) {
        for (const proofId of agentBConnectionRef2.invitationRequestsThreadIds) {
          await holder.acceptProof({ id: proofId });
        }
      }
      logger.info("remoteInvitation2", remoteInvitation2);
      await verifier.waitForPresentationV2(
        remoteInvitation2.payload.presentation_exchange_id as string
      );
      //expect(requests).toMatchSnapshot();
    },
    shortTimeout
  );
  test(
    "connectionless/present-proof-2.0/url-redirect",
    async () => {
      const verifier = agentVerifier;
      const holder = agentB;
      const { logger } = verifier;
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
        "studentInfo",
        new RequestAttributeBuilder()
          .setNames(["given_names", "family_name"])
          //.addRestriction({"cred_def_id": credDef.getId()})
          .addRestriction({
            schema_name: schema.getName(),
            schema_version: schema.getVersion(),
            issuer_did: credDef.getId()?.split(":")[0],
          })
          .setNonRevoked(seconds_since_epoch(new Date()))
      );
      const remoteInvitation2 = await withRedirectUrl(
        await verifier.sendConnectionlessProofRequestV2(proofRequest)
      );
      const agentBConnectionRef2 = await holder.receiveInvitation(
        remoteInvitation2
      );
      //console.dir(['agentBConnectionRef', agentBConnectionRef2])
      if (agentBConnectionRef2.invitationRequestsThreadIds) {
        for (const proofId of agentBConnectionRef2.invitationRequestsThreadIds) {
          await holder.acceptProof({ id: proofId });
        }
      }
      await verifier.waitForPresentationV2(
        remoteInvitation2.payload.presentation_exchange_id as string
      );
      //expect(requests).toMatchSnapshot();
    },
    shortTimeout
  );
  test(
    "OOB/connectionless/present-proof-1.0/encoded-payload",
    async () => {
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
        "studentInfo",
        new RequestAttributeBuilder()
          .setNames(["given_names", "family_name"])
          //.addRestriction({"cred_def_id": credDef.getId()})
          .addRestriction({
            schema_name: schema.getName(),
            schema_version: schema.getVersion(),
            issuer_did: credDef.getId()?.split(":")[0],
          })
          .setNonRevoked(seconds_since_epoch(new Date()))
      );
      await verifyCredentialB1(agentVerifier, agentB, proofRequest);
    },
    shortTimeout
  );
  test(
    "OOB/connectionless/present-proof-1.0/url-redirect",
    async () => {
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
        "studentInfo",
        new RequestAttributeBuilder()
          .setNames(["given_names", "family_name"])
          //.addRestriction({"cred_def_id": credDef.getId()})
          .addRestriction({
            schema_name: schema.getName(),
            schema_version: schema.getVersion(),
            issuer_did: credDef.getId()?.split(":")[0],
          })
          .setNonRevoked(seconds_since_epoch(new Date()))
      );
      await verifyCredentialB2(agentVerifier, agentB, proofRequest);
      //expect(requests).toMatchSnapshot();
    },
    shortTimeout
  );
  test(
    "OOB/connectionless/present-proof-2.0/encoded-payload",
    async () => {
      const verifier = agentVerifier;
      const holder = agentB;
      const { logger } = verifier;
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
        "studentInfo",
        new RequestAttributeBuilder()
          .setNames(["given_names", "family_name"])
          //.addRestriction({"cred_def_id": credDef.getId()})
          .addRestriction({
            schema_name: schema.getName(),
            schema_version: schema.getVersion(),
            issuer_did: credDef.getId()?.split(":")[0],
          })
          .setNonRevoked(seconds_since_epoch(new Date()))
      );

      const remoteInvitation3 =
        await verifier.sendOOBConnectionlessProofRequestV2(proofRequest);
      logger.info("remoteInvitation3", remoteInvitation3);
      logger.info(
        `Holder is receiving invitation for ${remoteInvitation3.payload.presentation_exchange_id}`
      );
      const agentBConnectionRef3 = await holder.receiveInvitation(
        remoteInvitation3
      );
      logger.info("Holder is accepting proofs");
      //await waitFor(10000)
      if (agentBConnectionRef3.invitationRequestsThreadIds) {
        for (const proofId of agentBConnectionRef3.invitationRequestsThreadIds) {
          await holder.acceptProof({ id: proofId });
        }
      }
      logger.info(
        `Verifier is waiting for proofs: ${remoteInvitation3.payload.presentation_exchange_id}`
      );
      await verifier.waitForPresentationV2(
        remoteInvitation3.payload.presentation_exchange_id as string
      );
      //expect(requests).toMatchSnapshot();
    },
    shortTimeout
  );
  test(
    "OOB/connectionless/present-proof-2.0/url-redirect",
    async () => {
      const verifier = agentVerifier;
      const holder = agentB;
      const { logger } = verifier;
      logger.info(`Executing ${expect.getState().currentTestName}`);
      const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
        "studentInfo",
        new RequestAttributeBuilder()
          .setNames(["given_names", "family_name"])
          //.addRestriction({"cred_def_id": credDef.getId()})
          .addRestriction({
            schema_name: schema.getName(),
            schema_version: schema.getVersion(),
            issuer_did: credDef.getId()?.split(":")[0],
          })
          .setNonRevoked(seconds_since_epoch(new Date()))
      );

      const remoteInvitation3 = await withRedirectUrl(
        await verifier.sendOOBConnectionlessProofRequestV2(proofRequest)
      );
      logger.info("remoteInvitation3", remoteInvitation3);
      logger.info(
        `Holder is receiving invitation for ${remoteInvitation3.payload.presentation_exchange_id}`
      );
      const agentBConnectionRef3 = await holder.receiveInvitation(
        remoteInvitation3
      );
      logger.info("Holder is accepting proofs");
      //await waitFor(10000)
      if (agentBConnectionRef3.invitationRequestsThreadIds) {
        for (const proofId of agentBConnectionRef3.invitationRequestsThreadIds) {
          await holder.acceptProof({ id: proofId });
        }
      }
      logger.info(
        `Verifier is waiting for proofs: ${remoteInvitation3.payload.presentation_exchange_id}`
      );
      await verifier.waitForPresentationV2(
        remoteInvitation3.payload.presentation_exchange_id as string
      );
      //expect(requests).toMatchSnapshot();
    },
    shortTimeout
  );

  describe("Proof Request", () => {
    test("create credential person offer (manual)", async () => {
      const issuer = agentIssuer;
      // const holder = new AgentManual(config.holder, logger)
      const cred = new PersonCredential1(credDef)
      console.log(cred.getCredDef()?.getSchemaId())
      const remoteInvitation = await issuer.createOOBInvitationToConnect(INVITATION_TYPE.OOB_CONN_1_0)
      logger.info('remoteInvitation', remoteInvitation)
      logger.info(`waiting for holder to accept connection`)

      const relativePath = `./tmp/proof/__issue_credential_request.png`;
      const QRCodePath = path.resolve(process.cwd() as string, relativePath);
      fs.mkdirSync(path.dirname(QRCodePath), { recursive: true });
      await QRCode.toFile(QRCodePath, remoteInvitation.payload.invitation_url, { margin: 10 });


      logger.info(`waiting for issuer to accept connection`)
      const { connection_id } = await issuer.waitForOOBConnectionReady(remoteInvitation.payload.invi_msg_id)
      await issuer.sendBasicMessage(connection_id, 'You are connected to the test bench')
      const credential_exchange_id = await issuer.sendCredential(cred, cred.getCredDef()?.getId() as string, connection_id)

      await issuer.waitForOfferAccepted(credential_exchange_id as string)


    }, stepTimeout)
    test(
      "create valid proof request qr code (manual)",
      async () => {
        const verifier = agentVerifier;
        const { logger } = verifier;
        logger.info(`Executing ${expect.getState().currentTestName}`);
        const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
          "studentInfo",
          new RequestAttributeBuilder()
            .setNames(["given_names", "family_name"])
            //.addRestriction({"cred_def_id": credDef.getId()})
            .addRestriction({
              schema_name: schema.getName(),
              schema_version: schema.getVersion(),
              issuer_did: schema.getSchemaId()?.split(":")[0],
            })
            .setNonRevoked(seconds_since_epoch(new Date()))
        );

        const remoteInvitation = await verifier.sendOOBConnectionlessProofRequestV2(proofRequest);
        const relativePath = `./tmp/proof/__valid_proof_request.png`;
        writeQRCode(relativePath, remoteInvitation.payload.invitation_url)
      },
      stepTimeout
    );
    test(
      "create invalid proof request qr code (manual)",
      async () => {
        const verifier = agentVerifier;
        const { logger } = verifier;
        logger.info(`Executing ${expect.getState().currentTestName}`);
        const proofRequest = new ProofRequestBuilder().addRequestedAttribute(
          "studentInfo",
          new RequestAttributeBuilder()
            .setNames(["given_names", "no_good"])
            //.addRestriction({"cred_def_id": credDef.getId()})
            .addRestriction({
              schema_name: schema.getName(),
              schema_version: schema.getVersion(),
              issuer_did: schema.getSchemaId()?.split(":")[0],
            })
            .setNonRevoked(seconds_since_epoch(new Date()))
        );

        const remoteInvitation = await verifier.sendOOBConnectionlessProofRequestV2(proofRequest);
        const relativePath = `./tmp/proof/__invalid_proof_request.png`;
        writeQRCode(relativePath, remoteInvitation.payload.invitation_url)
      },
      stepTimeout
    );
  });
});
