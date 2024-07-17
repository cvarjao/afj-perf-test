import { ConnectionRecord, OutOfBandRecord } from "@credo-ts/core";
import { CredentialDefinitionBuilder, ProofRequestBuilder, SchemaBuilder } from "./lib";

export type ConnectionRef = {connection_id: string}
export type Invitation = {invitation_url: string} & ConnectionRef
export type CredentialOfferRef = {id: string} & ConnectionRef

export type AcceptProofArgs = {id: string}
export type ReceiveInvitationResponse = { outOfBandRecord?: OutOfBandRecord; connectionRecord?: ConnectionRef, invitationRequestsThreadIds?: string[] }
export interface AriesAgent {
    createInvitationToConnect(): Promise<Invitation>
    receiveInvitation(invitation: Invitation): Promise<ReceiveInvitationResponse>;
    startup(): Promise<void>;
    shutdown(): Promise<void>;
    createSchema( builder: SchemaBuilder) : Promise<string |  undefined>
    createSchemaCredDefinition(credDefBuilder: CredentialDefinitionBuilder):  Promise<string |  undefined>
    findCredentialOffer(connectionId: string): Promise<CredentialOfferRef>
    acceptProof(proof: AcceptProofArgs): Promise<void>
    acceptCredentialOffer(offer: CredentialOfferRef): Promise<void>
    sendConnectionlessProofRequest(builder: ProofRequestBuilder): Promise<any |  undefined>
    sendOOBConnectionlessProofRequest(builder: ProofRequestBuilder): Promise<any | undefined>
    waitForPresentation(presentation_exchange_id: string): Promise<void>
}
