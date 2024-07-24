import { Logger, OutOfBandRecord } from "@credo-ts/core";
import { CredentialDefinitionBuilder, ProofRequestBuilder, SchemaBuilder } from "./lib";

export type InvitationRecordV2 = {invi_msg_id: string, invitation_url: string, invitation: any, presentation_exchange_id?: string}
export type InvitationRecordV1 = {connection_id?: string, invitation: any, invitation_url: string, presentation_exchange_id?: string}
export type Response<T,V> = {type: V, payload:  T}
export type ResponseCreateInvitationV1 = Response<InvitationRecordV1, "connections/1.0">
export type ResponseCreateInvitationV2 = Response<InvitationRecordV2, "didexchange/1.0">
export type ResponseCreateInvitation = ResponseCreateInvitationV1 | ResponseCreateInvitationV2

export type ConnectionRef = {connection_id: string}
export type Invitation = {invitation_url: string} & ConnectionRef
export type CredentialOfferRef = {id: string} & ConnectionRef

export type AcceptProofArgs = {id: string}
export type ReceiveInvitationResponse = { outOfBandRecord?: OutOfBandRecord; connectionRecord?: ConnectionRef, invitationRequestsThreadIds?: string[] }
export interface AriesAgent {
    readonly logger: Logger
    sendBasicMessage(connection_id: string, content: string): Promise<any>
    createInvitationToConnect(): Promise<ResponseCreateInvitation>
    receiveInvitation(invitation: ResponseCreateInvitation): Promise<ReceiveInvitationResponse>;
    startup(): Promise<void>;
    shutdown(): Promise<void>;
    createSchema( builder: SchemaBuilder) : Promise<string |  undefined>
    createSchemaCredDefinition(credDefBuilder: CredentialDefinitionBuilder):  Promise<string |  undefined>
    findCredentialOffer(connectionId: string): Promise<CredentialOfferRef>
    acceptProof(proof: AcceptProofArgs): Promise<void>
    acceptCredentialOffer(offer: CredentialOfferRef): Promise<void>
    sendConnectionlessProofRequest(builder: ProofRequestBuilder): Promise<ResponseCreateInvitation>
    sendOOBConnectionlessProofRequest(builder: ProofRequestBuilder): Promise<ResponseCreateInvitationV2>
    waitForPresentation(presentation_exchange_id: string): Promise<void>
}
