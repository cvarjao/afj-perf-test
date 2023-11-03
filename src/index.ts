import { Agent, InitConfig, ConsoleLogger, LogLevel, BaseLogger, MediationRecipientModule, MediatorPickupStrategy, InjectionSymbols, WalletConfig, WsOutboundTransport, HttpOutboundTransport, ConnectionsModule, CredentialsModule, AutoAcceptCredential, V2CredentialProtocol, ProofsModule, AutoAcceptProof, V2ProofProtocol } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { AskarModule, AskarWallet } from '@aries-framework/askar'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import {
    IndyVdrAnonCredsRegistry,
    IndyVdrModule,
} from '@aries-framework/indy-vdr'
import { indyVdr } from '@hyperledger/indy-vdr-nodejs'
import { AnonCredsCredentialFormatService, AnonCredsModule, AnonCredsProofFormatService, LegacyIndyCredentialFormatService, LegacyIndyProofFormatService, V1CredentialProtocol, V1ProofProtocol } from '@aries-framework/anoncreds'
import { AnonCredsRsModule } from '@aries-framework/anoncreds-rs'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import * as ledgers from '../ledgers.json'
import pino from 'pino'
import * as lib from './lib'
import { PersonCredential1, PersonSchema1 } from './mocks'
import { CredentialDefinitionBuilder } from './lib'

const perf = pino({ level: 'debug', timestamp: pino.stdTimeFunctions.isoTime, base: {group: new Date().getTime()} }, pino.transport({
    targets: [
      {
        level: 'debug',
        target: 'pino/file',
        options: {
          destination: './log.perf.ndjson',
        },
      }
    ],
}));

const logger = pino({ level: 'debug', timestamp: pino.stdTimeFunctions.isoTime, }, pino.transport({
    targets: [
      {
        level: 'debug',
        target: 'pino/file',
        options: {
          destination: './log.ndjson',
        },
      }
    ],
}));

class PinoLogger extends BaseLogger {
    test(message: string, data?: Record<string, any> | undefined): void {
        logger.debug({}, message, data)
    }
    trace(message: string, data?: Record<string, any> | undefined): void {
        logger.trace({}, message, data)
    }
    debug(message: string, data?: Record<string, any> | undefined): void {
        logger.debug(data || {}, message, )
    }
    info(message: string, data?: Record<string, any> | undefined): void {
        logger.info({}, message, data)
    }
    warn(message: string, data?: Record<string, any> | undefined): void {
        logger.warn({}, message, data)
    }
    error(message: string, data?: Record<string, any> | undefined): void {
        logger.error({}, message, data)
    }
    fatal(message: string, data?: Record<string, any> | undefined): void {
        console.dir(data)
        logger.fatal({}, message, data)
    }
    
}
const run = async () => {
    const config = require('../local.env.json')["sovrin_testnet"]
    const agentConfig: InitConfig = {
        label: 'afj-test',
        walletConfig: {
            id: 'afj-wallet',
            key: 'testkey0000000000000000000000000',
        },
        logger: new PinoLogger()
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
            anoncredsRs: new AnonCredsRsModule({
                anoncreds,
            }),
            indyVdr: new IndyVdrModule({
                indyVdr,
                networks: [...(ledgers as any).genesis.map((net: any) => { return { isProduction: false, indyNamespace: net.indyNamespace, genesisTransactions: net.genesisTransactions, connectOnStartup: true } })] as [any, ...any[]]
            }),
            anoncreds: new AnonCredsModule({
                registries: [new IndyVdrAnonCredsRegistry()],
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
    await wallet.open(agentConfig.walletConfig as unknown as WalletConfig)
    await wallet.delete()
    const wsTransport = new WsOutboundTransport()
    const httpTransport = new HttpOutboundTransport()

    agent.registerOutboundTransport(wsTransport)
    agent.registerOutboundTransport(httpTransport)
    await agent.initialize()
    .then(_ => { console.log("AFJ Agent initialized") })
    .catch((e) => {
        console.log(`Agent initialization failed with error\n${e}`);
        console.log('----error---')
        console.dir(e)
        process.exit(1)
    })
    const ctx = new lib.Context(config)
    const schema = new PersonSchema1()
    const credDef = new CredentialDefinitionBuilder().setSchema(schema).setSupportRevocation(true)
    await ctx.createAuthToken()
    await ctx.createSchema(schema)
    await ctx.createCredentialDefinition(credDef)
    const remoteInvitation = await ctx.createInvitationToConnect().then((data) => {console.log(`invitation connection_id=${data.connection_id}, label=${data.invitation.label}`); return data})
    const invitation = await agent?.oob.parseInvitation(ctx.getCurrentInvitationUrl())

    if (!invitation) {
      throw new Error('Could not parse invitation from URL')
    }
  
    const record = await agent?.oob.receiveInvitation(invitation)
    console.dir(record)
    await ctx.waitForConnectionReady()
    const personCred = new PersonCredential1()
    await ctx.sendCredential(personCred)
    while((await agent.credentials.getAll()).length == 0 ){}
    const creds = (await agent.credentials.getAll())
    console.log('Credentials:')
    console.dir(creds)
    console.log('Connections:')
    console.dir(await agent.connections.getAll())
    console.log('Connection:')
    const conn = (await agent.connections.getAll()).find((item) => item.theirLabel === remoteInvitation.invitation.label)!
    console.dir(conn)
    console.log('Credential:')
    const cred = (await agent.credentials.getAll()).find( (item) =>  item.connectionId === conn?.id)!
    console.dir(cred)
    console.log('Accepting Credential offer')
    console.time('acceptOffer')
    const startTime = performance.now()
    await agent.credentials.acceptOffer({ credentialRecordId: cred.id })
    const endTime = performance.now(); console.timeEnd('acceptOffer')
    await ctx.waitForOfferAccepted(personCred)
    perf.info({duration: (endTime - startTime) / 1000, label: remoteInvitation.invitation.label})
    console.log('shuttting down')
    await agent.shutdown()
    //agent.events.on()
}

run()
