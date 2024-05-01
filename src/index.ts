import { Agent, InitConfig, ConsoleLogger, LogLevel, BaseLogger, MediationRecipientModule, MediatorPickupStrategy, InjectionSymbols, WalletConfig, WsOutboundTransport, HttpOutboundTransport, ConnectionsModule, CredentialsModule, AutoAcceptCredential, V2CredentialProtocol, ProofsModule, AutoAcceptProof, V2ProofProtocol, ConnectionRecord, CredentialExchangeRecord, AgentEventTypes, ProofExchangeRecord } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { AskarModule, AskarWallet } from '@credo-ts/askar'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import {
    IndyVdrAnonCredsRegistry,
    IndyVdrModule,
} from '@credo-ts/indy-vdr'
import { indyVdr } from '@hyperledger/indy-vdr-nodejs'
import { AnonCredsCredentialFormatService, AnonCredsModule, AnonCredsProofFormatService, LegacyIndyCredentialFormatService, LegacyIndyProofFormatService, V1CredentialProtocol, V1ProofProtocol } from '@credo-ts/anoncreds'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import * as ledgers from '../ledgers.json'
import pino from 'pino'
import * as lib from './lib'
import { PersonCredential1, PersonSchema1 } from './mocks'
import { CredentialDefinitionBuilder, ProofRequestBuilder, RequestAttributeBuilder, seconds_since_epoch } from './lib'
import { IndyVdrPoolService } from '@credo-ts/indy-vdr/build/pool/IndyVdrPoolService'

const pertTransport = pino.transport({
  targets: [
    {
      level: 'trace',
      target: 'pino/file',
      options: {
        destination: './log.perf.ndjson',
        autoEnd: true,
      },
    }
  ],
})
const perf = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, base: {group: new Date().getTime()} }, pertTransport);

const loggerTransport = pino.transport({
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

const logger = pino({ level: 'trace', timestamp: pino.stdTimeFunctions.isoTime, }, loggerTransport);

class PinoLogger extends BaseLogger {
    test(message: string, data?: Record<string, any> | undefined): void {
        logger.debug(data || {}, message)
    }
    trace(message: string, data?: Record<string, any> | undefined): void {
        logger.trace(data || {}, message)
    }
    debug(message: string, data?: Record<string, any> | undefined): void {
        logger.debug(data || {}, message, )
    }
    info(message: string, data?: Record<string, any> | undefined): void {
        logger.info(data || {}, message)
    }
    warn(message: string, data?: Record<string, any> | undefined): void {
        logger.warn(data || {}, message)
    }
    error(message: string, data?: Record<string, any> | undefined): void {
        logger.error(data || {}, message)
    }
    fatal(message: string, data?: Record<string, any> | undefined): void {
        //console.dir(data)
        logger.fatal(data || {}, message)
    }
    
}

export const createLinkSecretIfRequired = async (agent: Agent) => {
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

const createAgent = async (config: any) => {
    const agentConfig: InitConfig = {
      label: 'afj-test',
      walletConfig: {
          id: 'afj-wallet',
          key: 'testkey0000000000000000000000000',
      },
      logger: new PinoLogger(LogLevel.trace)
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
    console.dir(ex)
  }
  const wsTransport = new WsOutboundTransport()
  const httpTransport = new HttpOutboundTransport()

  agent.registerOutboundTransport(wsTransport)
  agent.registerOutboundTransport(httpTransport)
  await agent.initialize()
  .then(_ => { console.log("AFJ Agent initialized") })
  createLinkSecretIfRequired(agent)
  const indyVdrPoolService = agent.dependencyManager.resolve(IndyVdrPoolService)
  await Promise.all(indyVdrPoolService.pools.map((pool) => (pool as unknown as any).pool.refresh()))
  return agent
}

const run = async () => {
    const config = require('../local.env.json')["sovrin_testnet"]
    const cycles = 1
    const steps = 1
    for (let cycle = 1; cycle <= cycles; cycle++) {
      console.log(`Starting cycle ${cycle}/${cycles}`)
      let agent!: Agent
      let agentRetryCount = 0
      while (agent === undefined) {
        try {
        agent = await createAgent(config)
        } catch (e) {
          console.log(`Agent initialization failed with error\n${e}`);
          console.log('----error---')
          console.dir(e)
        }
        agentRetryCount++
        if (agentRetryCount >5) {
          console.log(`Agent initializationfailed after 5 attempts`);
          process.exit(1)
        }
      }
      const ctx = new lib.Context(config)
      const schema = new PersonSchema1()
      const credDef = new CredentialDefinitionBuilder().setSchema(schema).setSupportRevocation(true)
      await ctx.createAuthToken()
      await ctx.createSchema(schema)
      await ctx.createCredentialDefinition(credDef)
  
  
      for (let step = 1; step <= steps; step++) {
        console.log(`Starting step ${step}/${steps} of cycle ${cycle}/${cycles}`)
        const remoteInvitation = await ctx.createInvitationToConnect().then((data) => {console.log(`invitation connection_id=${data.connection_id}, label=${data.invitation.label}`); return data})
        const invitation = await agent?.oob.parseInvitation(ctx.getCurrentInvitationUrl())
        if (!invitation) {
          throw new Error('Could not parse invitation from URL')
        }
        await agent?.oob.receiveInvitation(invitation)
        await ctx.waitForConnectionReady()
        //while((await agent.credentials.getAll()).length == 0 ){}
        const label = remoteInvitation.invitation.label
        console.log(`Connected with label ${label}`)
        let conn!: ConnectionRecord
        console.log(`Waiting for wallet connection`)
        agent.events.on(AgentEventTypes.AgentMessageReceived, (...args)=>{
          console.log('Message Received')
          console.dir(args, {depth: 6})
        })
        while (conn === undefined) {
          const items = await agent.connections.getAll()
          conn = items.find((item) => item.theirLabel === remoteInvitation.invitation.label)!
          //console.dir(items)
        }
        console.log(`Connection established`)
        console.log(`Sending Credential`)
        const personCred = new PersonCredential1()
        await ctx.sendCredential(personCred)
        let cred!: CredentialExchangeRecord
        console.log(`Waiting for wallet credential`)
        while (cred === undefined) {
          cred = (await agent.credentials.getAll()).find( (item) =>  item.connectionId === conn.id)!
        }
        console.log(`Accepting offer`)
        const startTime = performance.now()
        await agent.credentials.acceptOffer({ credentialRecordId: cred.id })
        const endTime = performance.now()
        await ctx.waitForOfferAccepted(personCred)
        perf.info({cycle, step, duration: (endTime - startTime) / 1000})

        const proofRequest = new ProofRequestBuilder()
            .addRequestedAttribute("studentInfo",
                new RequestAttributeBuilder()
                    .setNames(["given_names", "family_name"])
                    .addRestriction({"cred_def_id": credDef.getId()})
                    .setNonRevoked(seconds_since_epoch(new Date()))
            )
        await ctx.sendProofRequest(proofRequest)
        let proof!: ProofExchangeRecord
        console.log(`Waiting for proof in wallet`)
        while (proof === undefined) {
          proof = (await agent.proofs.getAll()).find( (item) =>  item.connectionId === conn.id)!
        }
        console.log(`Received proof:`)
        console.dir(proof)
        performance.mark('getFormatData')
        const credFormat = await agent.proofs.getFormatData(proof.id)
        performance.measure('getFormatData_duration', 'getFormatData')
        //const hasAnonCreds = credFormat.request?.anoncreds !== undefined
        //const hasIndy = credFormat.request?.indy !== undefined
        performance.mark('getCredentialsForRequest')
        const credentials = await agent.proofs.getCredentialsForRequest({proofRecordId: proof.id})
        performance.measure('getCredentialsForRequest_duration', 'getCredentialsForRequest')

        performance.mark('acceptRequest')
        agent.proofs.acceptRequest({proofRecordId: proof.id})
        performance.measure('acceptRequest_duration', 'acceptRequest')
        await ctx.waitForPresentation()
      }
      console.log('shuttting down')
      await agent.shutdown()
      for (const t of agent.outboundTransports) {
        await t.stop()
      }
      for (const t of agent.inboundTransports) {
        await t.stop()
      }
      await agent.mediationRecipient.stopMessagePickup()
    }
    
    //agent.events.on()
    pertTransport.unref()
    pertTransport.flushSync(); pertTransport.end();
    loggerTransport.unref()
    loggerTransport.flushSync(); loggerTransport.end();
    //console.dir(performance.getEntries(), {depth: 6})
    console.log('DONE')
    //process.exit()
}

run()
