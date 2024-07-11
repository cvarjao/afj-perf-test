import { AriesAgent, ConnectionRef, CredentialOfferRef, Invitation } from "./Agent";
import { Agent, ConnectionRecord, ConnectionsModule, CredentialExchangeRecord, CredentialsModule, Logger, MediationRecipientModule, ProofsModule, V2CredentialProtocol, V2ProofProtocol } from "@credo-ts/core";
import { AnonCredsCredentialFormatService, AnonCredsModule, AnonCredsProofFormatService, LegacyIndyCredentialFormatService, LegacyIndyProofFormatService, V1CredentialProtocol, V1ProofProtocol } from "@credo-ts/anoncreds";
import { AskarModule } from "@credo-ts/askar";
import { IndyVdrModule } from "@credo-ts/indy-vdr";
import { CredentialDefinitionBuilder, SchemaBuilder } from "./lib";
import QRCode from 'qrcode'
import readline from 'readline';
import fs from 'node:fs';
import path from 'node:path';

export class AgentManual implements AriesAgent {
    config: any;
    logger: Logger;
    public constructor(config:any,logger: Logger){
        this.config = config
        this.logger = logger
    }
    async acceptCredentialOffer(offer: CredentialOfferRef): Promise<void> {
      console.warn('Accept Credential')
    }
    async findCredentialOffer(connectionId: string): Promise<CredentialOfferRef> {
      return {id: 'undefined', connection_id: connectionId}
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
      const relativePath = '/Library/Android/sdk/emulator/resources/custom.png'
      const QRCodePath = path.join(process.env.HOME as string, relativePath)
      fs.mkdirSync(path.dirname(QRCodePath), { recursive: true });
      return QRCode.toFile(
            QRCodePath,
            invitationRef.invitation_url,
            {margin: 10}
        ).then (()=>{
            console.log(`QRCode saved to ~${relativePath}`)
            return {connection_id: 'undefined'}
        })
    }
    public async startup(){
    }
}