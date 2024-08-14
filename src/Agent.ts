import { Logger, OutOfBandRecord } from "@credo-ts/core";
import { CredentialDefinitionBuilder, ProofRequestBuilder, SchemaBuilder } from "./lib";

export type InvitationRecordV2 = {invi_msg_id: string, invitation_url: string, invitation: any, presentation_exchange_id?: string}
export type InvitationRecordV1 = {connection_id?: string, invitation: any, invitation_url: string, presentation_exchange_id?: string}

export enum INVITATION_TYPE {
    CONN_1_0 = `conn://https://didcomm.org/connections/1.0`,
    OOB_CONN_1_0 = `oob://https://didcomm.org/connections/1.0`,
    OOB_DIDX_1_1 = `oob://https://didcomm.org/didexchange/1.1`
}

export type InvitationPayloadMapping = {
    [INVITATION_TYPE.CONN_1_0]: InvitationRecordV1
    [INVITATION_TYPE.OOB_CONN_1_0]: InvitationRecordV2
    [INVITATION_TYPE.OOB_DIDX_1_1]: InvitationRecordV2
}

export type CreateInvitationResponse<T extends INVITATION_TYPE> = {type: T, payload:  InvitationPayloadMapping[T]}


export type ResponseCreateInvitationV1 = CreateInvitationResponse<INVITATION_TYPE.CONN_1_0>
export type ResponseCreateInvitationV2 = CreateInvitationResponse<INVITATION_TYPE.OOB_CONN_1_0> | CreateInvitationResponse<INVITATION_TYPE.OOB_DIDX_1_1>
export type ResponseCreateInvitation = ResponseCreateInvitationV1 | ResponseCreateInvitationV2

export type ConnectionRef = {connection_id: string}
export type Invitation = {invitation_url: string} & ConnectionRef
export type CredentialOfferRef = {id: string} & ConnectionRef

export type HasId = {id: string}
export type HadConnectionId = {connection_id: string}
export type AcceptProofArgs = HasId | HadConnectionId
export type ReceiveInvitationResponse = { outOfBandRecord?: OutOfBandRecord; connectionRecord?: ConnectionRef, invitationRequestsThreadIds?: string[] }

export interface AriesAgent {
    readonly logger: Logger
    sendBasicMessage(connection_id: string, content: string): Promise<any>
    createInvitationToConnect<T extends INVITATION_TYPE>(invitationType: T): Promise<CreateInvitationResponse<T>>
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
