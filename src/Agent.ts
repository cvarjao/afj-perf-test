export type ConnectionRef = {connection_id: string}
export type Invitation = {invitation_url: string} & ConnectionRef


export interface Agent {
    createInvitationToConnect(): Promise<Invitation>
    receiveInvitation(invitation: Invitation): ConnectionRef;
}
