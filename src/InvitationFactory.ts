export abstract class CreateInvitationFactory {

}
export class CreateInvitationFactoryConn1_0 extends CreateInvitationFactory {
    connectionless: boolean;
    constructor(connectionless:boolean = false){
        super();
        this.connectionless = connectionless
    }
}

export class CreateInvitationFactoryOOB extends CreateInvitationFactory {
    connectionless: boolean;
    constructor(connectionless:boolean = false){
        super();
        this.connectionless = connectionless
    }
}
