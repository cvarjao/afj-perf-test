import { CredentialDefinitionBuilder, ProofRequestBuilder, SchemaBuilder } from "./lib";

export type ConnectionRef = {connection_id: string}
export type Invitation = {invitation_url: string} & ConnectionRef
export type CredentialOfferRef = {id: string} & ConnectionRef

export interface AriesAgent {
    createInvitationToConnect(): Promise<Invitation>
    receiveInvitation(invitation: Invitation): Promise<ConnectionRef>;
    startup(): Promise<void>;
    createSchema( builder: SchemaBuilder) : Promise<string |  undefined>
    createSchemaCredDefinition(credDefBuilder: CredentialDefinitionBuilder):  Promise<string |  undefined>
    findCredentialOffer(connectionId: string): Promise<CredentialOfferRef>
    acceptCredentialOffer(offer: CredentialOfferRef): Promise<void>
    sendConnectionlessProofRequest(builder: ProofRequestBuilder): Promise<any |  undefined>
    waitForPresentation(presentation_exchange_id: string): Promise<void>
}
