import { AcceptProofArgs, AriesAgent, CreateInvitationResponse, CredentialOfferRef, INVITATION_TYPE, ReceiveInvitationResponse, ResponseCreateInvitation } from "./Agent";
import { Logger } from "@credo-ts/core";
import { CredentialDefinitionBuilder, ProofRequestBuilder, SchemaBuilder } from "./lib";
import QRCode from 'qrcode'
import fs from 'node:fs';
import path from 'node:path';
import { log } from "console"
import chalk from "chalk"

export class AgentManual implements AriesAgent {
    config: any;
    public readonly logger: Logger;
    public constructor(config:any,logger: Logger){
        this.config = config
        this.logger = logger
    }
  sendBasicMessage(_connection_id: string, content: string): Promise<any> {
    log(chalk.yellowBright(`> Send a message with '${content}' as content`))
    return Promise.resolve()
  }
  sendOOBConnectionlessProofRequest(_builder: ProofRequestBuilder): Promise<any | undefined> {
    throw new Error("Method not implemented.");
  }
  acceptProof(_proof: AcceptProofArgs): Promise<void> {
    //throw new Error("Method not implemented.");
    return Promise.resolve()
  }
  waitForPresentation(_presentation_exchange_id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  sendConnectionlessProofRequest(_builder: ProofRequestBuilder): Promise<ResponseCreateInvitation> {
    throw new Error("Method not implemented.");
  }
    async acceptCredentialOffer(_offer: CredentialOfferRef): Promise<void> {
      console.warn('Accept Credential')
    }
    async findCredentialOffer(connectionId: string): Promise<CredentialOfferRef> {
      return {id: 'undefined', connection_id: connectionId}
    }
    createSchemaCredDefinition(_credDefBuilder: CredentialDefinitionBuilder): Promise<string | undefined> {
      throw new Error("Method not implemented.");
    }
    createSchema(_builder: SchemaBuilder): Promise<string | undefined> {
        throw new Error("Method not implemented.");
    }
    async createInvitationToConnect<T extends INVITATION_TYPE>(_invitationType: T): Promise<CreateInvitationResponse<T>> {
        throw new Error("Method not implemented.");
    }
    async receiveInvitation(ref: ResponseCreateInvitation): Promise<ReceiveInvitationResponse> {
      const relativePath = './tmp/__qrcode.png'
      const QRCodePath = path.resolve(process.cwd() as string, relativePath)
      fs.mkdirSync(path.dirname(QRCodePath), { recursive: true })
      fs.writeFileSync(path.join(process.cwd(), 'invitation_url.txt'), ref.payload.invitation_url)
      fs.writeFileSync(path.join(process.cwd(), 'invitation.json'), JSON.stringify((ref.payload.invitation as any)))
      await QRCode.toFile(
            QRCodePath,
            ref.payload.invitation_url,
            {margin: 10}
      )
      log(chalk.yellowBright(`> Scan QR Code image from ${relativePath}`))
      return {}
    }
    public async startup(){
    }
    public async shutdown() {}
}