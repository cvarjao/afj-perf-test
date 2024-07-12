import axios from "axios";
import { AriesAgent, ConnectionRef, CredentialOfferRef, Invitation } from "./Agent";
import { Agent, AutoAcceptCredential, AutoAcceptProof, ConnectionRecord, ConnectionsModule, CredentialExchangeRecord, CredentialsModule, HttpOutboundTransport, InitConfig, InjectionSymbols, LogLevel, Logger, MediationRecipientModule, MediatorPickupStrategy, ProofsModule, V2CredentialProtocol, V2ProofProtocol, WalletConfig, WsOutboundTransport } from "@credo-ts/core";
import { AnonCredsCredentialFormatService, AnonCredsModule, AnonCredsProofFormatService, LegacyIndyCredentialFormatService, LegacyIndyProofFormatService, V1CredentialProtocol, V1ProofProtocol } from "@credo-ts/anoncreds";
import { AskarModule, AskarWallet } from "@credo-ts/askar";
import { IndyVdrAnonCredsRegistry, IndyVdrModule, IndyVdrPoolService } from "@credo-ts/indy-vdr";
import { agentDependencies } from "@credo-ts/node";
import { ariesAskar } from "@hyperledger/aries-askar-nodejs";
import { anoncreds } from "@hyperledger/anoncreds-nodejs";
import { indyVdr } from "@hyperledger/indy-vdr-nodejs";
import { CredentialDefinitionBuilder, ProofRequestBuilder, SchemaBuilder } from "./lib";


const createLinkSecretIfRequired = async (agent: Agent) => {
    // If we don't have any link secrets yet, we will create a
    // default link secret that will be used for all anoncreds
    // credential requests.
    const linkSecretIds = await agent.modules.anoncreds.getLinkSecretIds()
    if (linkSecretIds.length === 0) {
      await agent.modules.anoncreds.createLinkSecret({
        setAsDefault: true,
      })
    }
  }

const createAgent = async (config: any, ledgers: any, logger?: Logger) => {
    const agentConfig: InitConfig = {
      label: 'afj-test',
      walletConfig: {
          id: 'afj-wallet',
          key: 'testkey0000000000000000000000000',
      },
      logger: logger
  }
  const indyCredentialFormat = new LegacyIndyCredentialFormatService()
  const indyProofFormat = new LegacyIndyProofFormatService()
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
              networks: [...(ledgers as any).genesis.map((net: any) => { return { isProduction: false, indyNamespace: net.indyNamespace, genesisTransactions: net.genesisTransactions, connectOnStartup: true } })] as [any, ...any[]]
          }),
          mediationRecipient: new MediationRecipientModule({
              mediatorInvitationUrl: config.mediatorInvitationUrl,
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
                  credentialFormats: [indyCredentialFormat, new AnonCredsCredentialFormatService()],
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
  })
  
  //console.log(`Mediator URL:${config.mediatorInvitationUrl}`)
  const wallet = agent.dependencyManager.resolve(InjectionSymbols.Wallet) as AskarWallet
  try{
    await wallet.open(agentConfig.walletConfig as unknown as WalletConfig)
    await wallet.delete()
  } catch (ex){
    console.error('Error opening wallet')
    console.dir(ex)
  }
  const wsTransport = new WsOutboundTransport()
  const httpTransport = new HttpOutboundTransport()

  agent.registerOutboundTransport(wsTransport)
  agent.registerOutboundTransport(httpTransport)
  await agent.initialize().then(_ => { console.log("AFJ Agent initialized") })
  createLinkSecretIfRequired(agent)
  const indyVdrPoolService = agent.dependencyManager.resolve(IndyVdrPoolService)
  await Promise.all(indyVdrPoolService.pools.map((pool) => (pool as unknown as any).pool.refresh()))
  return agent
}

export class AgentCredo implements AriesAgent {
    config: any;
    ledgers: any;
    logger: Logger;
    agent!: Agent<{
        // Register the Askar module on the agent
        // We do this to have access to a wallet
        askar: AskarModule; anoncreds: AnonCredsModule; indyVdr: IndyVdrModule; mediationRecipient: MediationRecipientModule; connections: ConnectionsModule; credentials: CredentialsModule<(V1CredentialProtocol | V2CredentialProtocol<(LegacyIndyCredentialFormatService | AnonCredsCredentialFormatService)[]>)[]>; proofs: ProofsModule<(V1ProofProtocol | V2ProofProtocol<(LegacyIndyProofFormatService | AnonCredsProofFormatService)[]>)[]>;
    }>;
    public constructor(config:any, ledgers: any, logger: Logger){
        this.config = config
        this.ledgers = ledgers
        this.logger = logger
    }
    waitForPresentation(presentation_exchange_id: string): Promise<void> {
      throw new Error("Method not implemented.");
    }
    sendConnectionlessProofRequest(builder: ProofRequestBuilder): Promise<any | undefined> {
      throw new Error("Method not implemented.");
    }
    async acceptCredentialOffer(offer: CredentialOfferRef): Promise<void> {
      await this.agent.credentials.acceptOffer({ credentialRecordId: offer.id })
    }
    async findCredentialOffer(connectionId: string): Promise<CredentialOfferRef> {
      let cred!: CredentialExchangeRecord
      while (cred === undefined) {
        cred = (await this.agent.credentials.getAll()).find( (item) =>  item.connectionId === connectionId)!
      }
      return {id: cred.id, connection_id: cred.connectionId as string}
    }
    createSchemaCredDefinition(credDefBuilder: CredentialDefinitionBuilder): Promise<string | undefined> {
      throw new Error("Method not implemented.");
    }
    createSchema(builder: SchemaBuilder): Promise<string | undefined> {
        throw new Error("Method not implemented.");
    }
    createInvitationToConnect(): Promise<Invitation> {
        throw new Error("Method not implemented.");
    }
    async receiveInvitation(invitationRef: Invitation): Promise<ConnectionRef> {
      const invitation = await this.agent?.oob.parseInvitation(invitationRef.invitation_url)
      if (!invitation) {
        throw new Error('Could not parse invitation from URL')
      }
      await this.agent.oob.receiveInvitation(invitation)
      let conn!: ConnectionRecord
      while (conn === undefined) {
        const items = await this.agent.connections.getAll()
        conn = items.find((item) => item.theirLabel === invitation.label)!
      }
      return {connection_id: conn.id}
    }
    public async startup(){
        this.agent = await createAgent(this.config, this.ledgers, this.logger)
    }
}