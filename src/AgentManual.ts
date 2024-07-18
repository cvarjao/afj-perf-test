import { AcceptProofArgs, AriesAgent, CredentialOfferRef, Invitation, ReceiveInvitationResponse } from "./Agent";
import { Logger } from "@credo-ts/core";
import { CredentialDefinitionBuilder, ProofRequestBuilder, SchemaBuilder } from "./lib";
import QRCode from 'qrcode'
import fs from 'node:fs';
import path from 'node:path';

export class AgentManual implements AriesAgent {
    config: any;
    public readonly logger: Logger;
    public constructor(config:any,logger: Logger){
        this.config = config
        this.logger = logger
    }
  sendOOBConnectionlessProofRequest(builder: ProofRequestBuilder): Promise<any | undefined> {
    throw new Error("Method not implemented.");
  }
  acceptProof(proof: AcceptProofArgs): Promise<void> {
    //throw new Error("Method not implemented.");
    return Promise.resolve()
  }
  waitForPresentation(presentation_exchange_id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  sendConnectionlessProofRequest(builder: ProofRequestBuilder): Promise<string | undefined> {
    throw new Error("Method not implemented.");
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
    async receiveInvitation(invitationRef: Invitation): Promise<ReceiveInvitationResponse> {
      const relativePath = '/Library/Android/sdk/emulator/resources/custom.png'
      const QRCodePath = path.join(process.env.HOME as string, relativePath)
      fs.mkdirSync(path.dirname(QRCodePath), { recursive: true })
      fs.writeFileSync(path.join(process.cwd(), 'invitation_url.txt'), invitationRef.invitation_url)
      fs.writeFileSync(path.join(process.cwd(), 'invitation.json'), JSON.stringify((invitationRef as any)))
      await QRCode.toFile(
            QRCodePath,
            invitationRef.invitation_url,
            {margin: 10}
      )
      return {}
    }
    public async startup(){
    }
    public async shutdown() {}
}