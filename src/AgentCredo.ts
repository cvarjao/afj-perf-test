import {
  AcceptProofArgs,
  AriesAgent,
  CreateInvitationResponse,
  CredentialOfferRef,
  INVITATION_TYPE,
  ReceiveInvitationResponse,
  ResponseCreateInvitation,
} from "./Agent";
import {
  Agent,
  AutoAcceptCredential,
  AutoAcceptProof,
  ConnectionRecord,
  ConnectionsModule,
  CredentialExchangeRecord,
  CredentialsModule,
  HttpOutboundTransport,
  InitConfig,
  Logger,
  MediationRecipientModule,
  MediatorPickupStrategy,
  ProofsModule,
  V2CredentialProtocol,
  V2ProofProtocol,
  WsOutboundTransport,
  BasicMessageRecord,
  RecordSavedEvent,
  RepositoryEventTypes,
  BaseRecord,
  BaseEvent,

} from "@credo-ts/core";
import {
  AnonCredsCredentialFormatService,
  AnonCredsModule,
  AnonCredsProofFormatService,
  LegacyIndyCredentialFormatService,
  LegacyIndyProofFormatService,
  V1CredentialProtocol,
  V1ProofProtocol,
} from "@credo-ts/anoncreds";
import { AskarModule } from "@credo-ts/askar";
import {
  IndyVdrAnonCredsRegistry,
  IndyVdrModule,
  IndyVdrPoolService,
} from "@credo-ts/indy-vdr";
import { agentDependencies } from "@credo-ts/node";
import { ariesAskar } from "@hyperledger/aries-askar-nodejs";
import { anoncreds } from "@hyperledger/anoncreds-nodejs";
import { indyVdr } from "@hyperledger/indy-vdr-nodejs";
import {
  CredentialDefinitionBuilder,
  ProofRequestBuilder,
  SchemaBuilder,
  waitFor,
} from "./lib";
import { IndyVdrPoolConfig } from "@credo-ts/indy-vdr";
import { OutOfBandRecord } from "@credo-ts/core";

import type { Constructor } from '@credo-ts/core/build/utils/mixins'
import { Subscription, map, filter, pipe } from 'rxjs'

type BaseRecordAny = BaseRecord<any, any, any>
type RecordClass<R extends BaseRecordAny> = Constructor<R> & { type: string }

const createLinkSecretIfRequired = async (agent: Agent) => {
  // If we don't have any link secrets yet, we will create a
  // default link secret that will be used for all anoncreds
  // credential requests.
  const linkSecretIds = await agent.modules.anoncreds.getLinkSecretIds();
  if (linkSecretIds.length === 0) {
    await agent.modules.anoncreds.createLinkSecret({
      setAsDefault: true,
    });
  }
};

export const createAgent = async (
  config: any,
  ledgers: IndyVdrPoolConfig[],
  logger?: Logger
) => {
  const agentConfig: InitConfig = {
    label: "afj-test-2-z",
    walletConfig: {
      id: "afj-wallet-2-z",
      key: "testkey0000000000000000000000000",
    },
    autoUpdateStorageOnStartup: true,
    backupBeforeStorageUpdate: false,
    logger: logger,
  };
  const indyCredentialFormat = new LegacyIndyCredentialFormatService();
  const indyProofFormat = new LegacyIndyProofFormatService();
  const agent = new Agent({
    config: agentConfig,
    dependencies: agentDependencies,
    modules: {
      // Register the Askar module on the agent
      // We do this to have access to a wallet
      askar: new AskarModule({
        ariesAskar,
      }),
      anoncreds: new AnonCredsModule({
        registries: [new IndyVdrAnonCredsRegistry()],
        anoncreds,
      }),
      indyVdr: new IndyVdrModule({
        indyVdr,
        networks: ledgers as [IndyVdrPoolConfig],
      }),
      mediationRecipient: new MediationRecipientModule({
        mediatorInvitationUrl: config.mediatorInvitationUrl ?? "",
        mediatorPickupStrategy: MediatorPickupStrategy.Implicit,
      }),
      connections: new ConnectionsModule({
        autoAcceptConnections: true,
      }),
      credentials: new CredentialsModule({
        autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
        credentialProtocols: [
          new V1CredentialProtocol({ indyCredentialFormat }),
          new V2CredentialProtocol({
            credentialFormats: [
              indyCredentialFormat,
              new AnonCredsCredentialFormatService(),
            ],
          }),
        ],
      }),
      proofs: new ProofsModule({
        autoAcceptProofs: AutoAcceptProof.ContentApproved,
        proofProtocols: [
          new V1ProofProtocol({ indyProofFormat }),
          new V2ProofProtocol({
            proofFormats: [indyProofFormat, new AnonCredsProofFormatService()],
          }),
        ],
      }),
    },
  });

  //console.log(`Mediator URL:${config.mediatorInvitationUrl}`)
  //const wallet = agent.dependencyManager.resolve(InjectionSymbols.Wallet) as AskarWallet
  //console.dir(wallet)
  /*
  try {
    fs.rmSync(path.join(homedir(), ".afj"), {
      recursive: true,
      force: true,
    });
  } catch (error) {
    console.log(error);
  }
  try {
    fs.rmSync(path.join(tmpdir(), ".afj"), {
      recursive: true,
      force: true,
    });
  } catch (error) {
    console.log(error);
  }
  */
  console.dir(agentConfig.walletConfig);
  /*
  try {
    await wallet.createAndOpen(agentConfig.walletConfig as unknown as WalletConfig)
    //await wallet.open(agentConfig.walletConfig as unknown as WalletConfig)
    //await wallet.delete()
  } catch (error) {
    console.log('Error with createAndOpen')
    console.dir(error)
  }
  */
  const wsTransport = new WsOutboundTransport();
  const httpTransport = new HttpOutboundTransport();

  agent.registerOutboundTransport(wsTransport);
  agent.registerOutboundTransport(httpTransport);
  
  await agent.initialize();

  console.log("AFJ Agent initialized");

  if (config.mediatorInvitationUrl) {
    await agent.mediationRecipient.initiateMessagePickup(undefined, MediatorPickupStrategy.Implicit)
  }
  
  createLinkSecretIfRequired(agent);
  
  const indyVdrPoolService =
    agent.dependencyManager.resolve(IndyVdrPoolService);
  await Promise.all(
    indyVdrPoolService.pools.map((pool) =>
      (pool as unknown as any).pool.refresh()
    )
  );
  
  return agent;
};

export class AgentCredo implements AriesAgent {
  public basicMessageReceivedSubscription?: Subscription;

  config: any;
  ledgers: any[];
  public readonly logger: Logger;
  agent!: Agent<{
    // Register the Askar module on the agent
    // We do this to have access to a wallet
    askar: AskarModule;
    anoncreds: AnonCredsModule;
    indyVdr: IndyVdrModule;
    mediationRecipient: MediationRecipientModule;
    connections: ConnectionsModule;
    credentials: CredentialsModule<
      (
        | V1CredentialProtocol
        | V2CredentialProtocol<
            (
              | LegacyIndyCredentialFormatService
              | AnonCredsCredentialFormatService
            )[]
          >
      )[]
    >;
    proofs: ProofsModule<
      (
        | V1ProofProtocol
        | V2ProofProtocol<
            (LegacyIndyProofFormatService | AnonCredsProofFormatService)[]
          >
      )[]
    >;
  }>;

  public constructor(config: any, ledgers: any, logger: Logger) {
    this.config = config;
    this.ledgers = ledgers;
    this.logger = logger;
  }

  set onBasicMessageReceived(messageRecievedCb: (message: BasicMessageRecord) => void) {
    if (messageRecievedCb) {
      if (this.basicMessageReceivedSubscription) {
        this.basicMessageReceivedSubscription.unsubscribe()
      }

      const sub = this.recordsAddedByType(BasicMessageRecord).subscribe(messageRecievedCb)
      this.basicMessageReceivedSubscription = sub

      return
    }

    this.basicMessageReceivedSubscription?.unsubscribe()
    this.basicMessageReceivedSubscription = undefined
  }
  
  private filterByType = <R extends BaseRecordAny>(recordClass: RecordClass<R>) => {
    return pipe(
      map((event: BaseEvent) => (event.payload as Record<string, R>).record),
      filter((record: R) => record.type === recordClass.type),
    )
  }
  
  private recordsAddedByType = <R extends BaseRecordAny>(recordClass: RecordClass<R>) => {
    if (!this.agent) {
      throw new Error('Agent is required to check record type')
    }
  
    if (!recordClass) {
      throw new Error("The recordClass can't be undefined")
    }
  
    return this.agent?.events.observable<RecordSavedEvent<R>>(RepositoryEventTypes.RecordSaved).pipe(this.filterByType(recordClass))
  }

  sendBasicMessage(connection_id: string, content: string): Promise<any> {
    return this.agent.basicMessages.sendMessage(connection_id, content)
  }

  sendOOBConnectionlessProofRequest(
    _builder: ProofRequestBuilder
  ): Promise<any | undefined> {
    throw new Error("Method not implemented.");
  }

  waitForPresentation(_presentation_exchange_id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  sendConnectionlessProofRequest(
    _builder: ProofRequestBuilder
  ): Promise<any | undefined> {
    throw new Error("Method not implemented.");
  }

  async acceptCredentialOffer(offer: CredentialOfferRef): Promise<void> {
    await this.agent.credentials.acceptOffer({ credentialRecordId: offer.id });
  }

  async acceptProof(proof: AcceptProofArgs): Promise<void> {
    
      while (true) {
        const proofs = await this.agent.proofs.getAll();
        //console.log(`Proofs ${proofs.length}`)
        for (let index = 0; index < proofs.length; index++) {
          const p = proofs[index];
          //console.dir(p.toJSON());
          if ("id" in proof) {
            //console.log(`[${index + 1}/${proofs.length}] -  id:${p.id}, threadId:${p.threadId}, arg:${proof.id}`);
            if (p.threadId === proof.id) {
              await this.agent.proofs.acceptRequest({ proofRecordId: p.id });
              return;
            }
          } else if ("connection_id" in proof) {
            if (p.connectionId ===  proof.connection_id){
              await this.agent.proofs.acceptRequest({ proofRecordId: p.id });
              return;
            }
          }
        }
        waitFor(1000);
      }
  }

  async findCredentialOffer(connectionId: string): Promise<CredentialOfferRef> {
    let cred!: CredentialExchangeRecord;
    while (cred === undefined) {
      cred = (await this.agent.credentials.getAll()).find(
        (item) => item.connectionId === connectionId
      )!;
    }
    return { id: cred.id, connection_id: cred.connectionId as string };
  }

  createSchemaCredDefinition(
    _credDefBuilder: CredentialDefinitionBuilder
  ): Promise<string | undefined> {
    throw new Error("Method not implemented.");
  }

  createSchema(_builder: SchemaBuilder): Promise<string | undefined> {
    throw new Error("Method not implemented.");
  }

  async createInvitationToConnect<T extends INVITATION_TYPE>(_invitationType: T): Promise<CreateInvitationResponse<T>> {
    throw new Error("Method not implemented.");
  }

  async receiveInvitation(
    inv: ResponseCreateInvitation
  ): Promise<ReceiveInvitationResponse> {
    console.log(`Receiving invitation from ${inv.payload.invitation_url}`);
    const invitation = await this.agent?.oob.parseInvitation(
      inv.payload.invitation_url
    );
    if (!invitation) {
      throw new Error("Could not parse invitation from URL");
    }
    const {
      outOfBandRecord,
      connectionRecord,
    }: {
      outOfBandRecord: OutOfBandRecord;
      connectionRecord?: ConnectionRecord;
    } = await this.agent.oob.receiveInvitation(invitation, {
      autoAcceptInvitation: true,
      autoAcceptConnection: true,
      reuseConnection: true,
    });

    const invitationRequestsThreadIds =
      outOfBandRecord.getTags().invitationRequestsThreadIds;

    console.log(`outOfBandRecord.state=${outOfBandRecord.state}`);
    console.dir(outOfBandRecord.toJSON());
    console.log(`invitationRequestsThreadIds=${invitationRequestsThreadIds}`);
    /*
      while (connectionRecord && !connectionRecord?.isReady === true) {
        console.log(`connectionRecord.state=${connectionRecord.state}`)
        await delay(100)
        //no-op, waiting for connection to be ready
      }
        */
    /*
      while (outOfBandRecord && outOfBandRecord.state !== OutOfBandState.Done) {
        //no-op, waiting for connection to be ready
        console.log(`outOfBandRecord.state=${outOfBandRecord.state}`)
      }
      */
    return {
      outOfBandRecord,
      invitationRequestsThreadIds,
      connectionRecord: { connection_id: connectionRecord?.id as string },
    };
  }

  public async startup() {
    this.agent = await createAgent(this.config, this.ledgers, this.logger);
  }

  public async shutdown() {
    await this.agent?.mediationRecipient?.stopMessagePickup();
    await this.agent?.shutdown();

   this.basicMessageReceivedSubscription?.unsubscribe()
  }
}
