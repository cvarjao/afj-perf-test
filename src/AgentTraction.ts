import _axios, { AxiosInstance } from "axios";
import {
    AcceptProofArgs,
    AriesAgent,
    ConnectionRef,
    CreateInvitationResponse,
    CredentialOfferRef,
    INVITATION_TYPE,
    ReceiveInvitationResponse,
    ResponseCreateInvitation,
    ResponseCreateInvitationV1,
    ResponseCreateInvitationV2,
} from "./Agent";
import {
    CredentialDefinitionBuilder,
    extractResponseData,
    IssueCredentialPreviewV1,
    printResponse,
    ProofRequestBuilder,
    SchemaBuilder,
} from "./lib";
import { Logger } from "@credo-ts/core";

export class AgentTraction implements AriesAgent {
    public axios: AxiosInstance;
    private config: any;
    public readonly logger: Logger;
    public constructor(config: any, logger: Logger) {
        this.config = config;
        this.axios = _axios.create({ baseURL: config.base_url });
        this.logger = logger;
        /*
            this.axios.interceptors.request.use(function (config) {
                this.logger.info(`Requesting ${config.url}`)
                return config;
              }, function (error) {
                // Do something with request error
                return Promise.reject(error);
            });
            */
    }
    shutdown(): Promise<void> {
        //throw new Error("Method not implemented.");
        return Promise.resolve();
    }
    acceptProof(_proof: AcceptProofArgs): Promise<void> {
        throw new Error("Method not implemented.");
    }
    async waitForLedgerTransactionAcked(txn_id: string, counter: number) {
        await this.axios
            .get(`/transactions/${txn_id}`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then((value) => {
                this.logger.info(`transaction ${txn_id} state: ${value.data.state}`);
                if (value.data.state !== "transaction_acked") {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(this.waitForLedgerTransactionAcked(txn_id, counter + 1));
                        }, 2000);
                    });
                }
            });
    }
    async _waitForOOBConnectionRecord(
        invitation_msg_id: string,
        counter: number
    ): Promise<ConnectionRef> {
        return this.axios
            .get(`/connections`, {
                params: {
                    invitation_msg_id: invitation_msg_id,
                },
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(printResponse)
            .then((value) => {
                const results = value.data.results as any[];
                if (results.length == 0) {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(
                                this._waitForOOBConnectionRecord(invitation_msg_id, counter + 1)
                            );
                        }, 2000);
                    });
                }
                return results[0] as ConnectionRef;
            });
    }
    async _waitForConnectionReady(connection_id: string, counter: number) {
        await this.axios
            .get(`/connections/${connection_id}`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then((value) => {
                this.logger.info(`connection state: ${value.data.state}`);
                if (value.data.state !== "active") {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(this._waitForConnectionReady(connection_id, counter + 1));
                        }, 2000);
                    });
                }
            });
    }

    async _waitForProofRequestV1(
        presentation_exchange_id: string,
        config: any,
        http: AxiosInstance,
        counter: number
    ) {
        //this.logger.info(`/present-proof/records/${config.presentation_exchange_id}`)
        await http
            .get(`/present-proof/records/${presentation_exchange_id}`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            //.then(printResponse)
            .then((value) => {
                this.logger.info(
                    `proof request state: ${value.data.state} #${counter}`
                );
                if (
                    !(value.data.state === "verified" || value.data.state === "abandoned")
                ) {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(
                                this._waitForProofRequestV1(
                                    presentation_exchange_id,
                                    config,
                                    http,
                                    counter + 1
                                )
                            );
                        }, 2000);
                    });
                }
            });
    }
    async _waitForProofRequestV2(
        presentation_exchange_id: string,
        config: any,
        http: AxiosInstance,
        counter: number
    ) {
        //this.logger.info(`/present-proof/records/${config.presentation_exchange_id}`)
        await http
            .get(`/present-proof-2.0/records/${presentation_exchange_id}`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            //.then(printResponse)
            .then((value) => {
                this.logger.info(
                    `proof request state: ${value.data.state} #${counter}`
                );
                if (
                    !(value.data.state === "done" || value.data.state === "abandoned")
                ) {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(
                                this._waitForProofRequestV2(
                                    presentation_exchange_id,
                                    config,
                                    http,
                                    counter + 1
                                )
                            );
                        }, 2000);
                    });
                }
            });
    }
    async clearAllRecords() {
        let records: any[] | undefined = undefined;

        this.logger.info(`Clearing Presentantion Exchage Records `);
        while (records == undefined || records?.length > 0) {
            records = await this.axios
                .get(`/present-proof/records`, {
                    params: {},
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.config.auth_token}`,
                    },
                })
                .then(printResponse)
                .then(extractResponseData)
                .then((data: any) => {
                    return data.results;
                });
            if (records !== undefined && records.length > 0) {
                for (const record of records) {
                    await this.axios
                        .delete(
                            `/present-proof/records/${record.presentation_exchange_id}`,
                            {
                                params: {},
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${this.config.auth_token}`,
                                },
                            }
                        )
                        .then(printResponse);
                }
            }
        }

        this.logger.info(`Clearing Credential Issuance Records `);
        records = undefined;
        while (records == undefined || records?.length > 0) {
            records = await this.axios
                .get(`/issue-credential/records`, {
                    params: {},
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.config.auth_token}`,
                    },
                })
                .then(extractResponseData)
                .then((data: any) => {
                    return data.results;
                });
            if (records !== undefined && records?.length > 0) {
                for (const record of records) {
                    await this.axios
                        .delete(
                            `/issue-credential/records/${record.credential_exchange_id}`,
                            {
                                params: {},
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${this.config.auth_token}`,
                                },
                            }
                        )
                        .then(printResponse);
                }
            }
        }
        this.logger.info(`Clearing Connections`);
        records = undefined;
        while (records == undefined || records?.length > 0) {
            records = await this.axios
                .get(`/connections`, {
                    params: {},
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.config.auth_token}`,
                    },
                })
                .then(printResponse)
                .then(extractResponseData)
                .then((data: any) => {
                    return data.results;
                });
            records = records?.filter((item) => !item?.alias?.endsWith("-endorser"));
            if (records !== undefined && records.length > 0) {
                for (const record of records) {
                    await this.axios
                        .delete(`/connections/${record.connection_id}`, {
                            params: {},
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${this.config.auth_token}`,
                            },
                        })
                        .then(printResponse);
                }
            }
        }
    }
    waitForPresentation(presentation_exchange_id: string): Promise<void> {
        this.logger.info(`Waiting for Presentation ...`);
        return this._waitForProofRequestV1(
            presentation_exchange_id,
            this.config,
            this.axios,
            0
        );
    }
    async waitForPresentationV2(presentation_exchange_id: string): Promise<void> {
        this.logger.info(`Waiting for Presentation ...`);
        return this._waitForProofRequestV2(
            presentation_exchange_id,
            this.config,
            this.axios,
            0
        );
    }
    async createPresentProofV1(builder: ProofRequestBuilder): Promise<any> {
        const proofRequest = builder.build();
        return await this.axios
            .post(
                `/present-proof/create-request`,
                {
                    auto_remove: false,
                    auto_verify: true,
                    comment: "string",
                    trace: false,
                    proof_request: proofRequest,
                },
                {
                    params: {},
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.config.auth_token}`,
                    },
                }
            )
            .then(printResponse)
            .then(extractResponseData);
    }
    async createPresentProofV2(
        builder: ProofRequestBuilder
    ): Promise<any | undefined> {
        const proofRequest = builder.buildv2();
        return await this.axios
            .post(
                `/present-proof-2.0/create-request`,
                {
                    auto_remove: false,
                    auto_verify: true,
                    comment: "string",
                    trace: false,
                    presentation_request: proofRequest,
                },
                {
                    params: {},
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.config.auth_token}`,
                    },
                }
            )
            .then(printResponse)
            .then(extractResponseData);
    }

    async sendOOBConnectionlessProofRequest(
        builder: ProofRequestBuilder
    ): Promise<ResponseCreateInvitationV2> {
        const proof = await this.createPresentProofV1(builder);
        const create_invitation_payload = {
            attachments: [
                {
                    id: proof["presentation_exchange_id"],
                    type: "present-proof",
                    data: { json: proof },
                },
            ],
            label: "vc-authn-oidc",
            //"goal": "request-proof",
            //"goal_code": "request-proof",
            use_public_did: false,
            //handshake_protocols:['https://didcomm.org/connections/1.0'],
            //handshake_protocols:['https://didcomm.org/connections/1.0', 'https://didcomm.org/didexchange/1.0'],
        };
        this.logger.info("create_invitation_payload", create_invitation_payload);
        const invitation: any = await this.axios
            .post(`/out-of-band/create-invitation`, create_invitation_payload, {
                params: {},
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(extractResponseData);
        this.logger.info("OOB_invitation", invitation);
        delete invitation.invitation.handshake_protocols;
        invitation.invitation_url =
            "bcwallet://launch?oob=" +
            encodeURIComponent(
                Buffer.from(JSON.stringify(invitation.invitation)).toString("base64")
            );

        return {
            type: INVITATION_TYPE.OOB_DIDX_1_1,
            payload: {
                invitation: invitation.invitation,
                invitation_url: invitation.invitation_url,
                presentation_exchange_id: proof.presentation_exchange_id,
                invi_msg_id: invitation.invi_msg_id,
            },
        };
    }
    async sendOOBConnectionlessProofRequestV2(
        builder: ProofRequestBuilder
    ): Promise<ResponseCreateInvitationV2> {
        const proof = await this.createPresentProofV2(builder);
        const create_invitation_payload = {
            attachments: [
                {
                    id: proof["pres_ex_id"],
                    type: "present-proof",
                    data: { json: proof },
                },
            ],
            label: "vc-authn-oidc",
            //"goal": "request-proof",
            //"goal_code": "request-proof",
            use_public_did: false,
            //handshake_protocols:['https://didcomm.org/connections/1.0'],
            //handshake_protocols:['https://didcomm.org/connections/1.0', 'https://didcomm.org/didexchange/1.0'],
        };
        this.logger.info("create_invitation_payload", create_invitation_payload);
        const invitation: any = await this.axios
            .post(`/out-of-band/create-invitation`, create_invitation_payload, {
                params: {},
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(extractResponseData);
        this.logger.info("OOB_invitation", invitation);
        delete invitation.invitation.handshake_protocols;
        invitation.invitation_url =
            "bcwallet://launch?oob=" +
            encodeURIComponent(
                Buffer.from(JSON.stringify(invitation.invitation)).toString("base64")
            );
        //return {...invitation, presentation_exchange_id:proof["pres_ex_id"]}
        return {
            type: INVITATION_TYPE.OOB_DIDX_1_1,
            payload: {
                invitation: invitation.invitation,
                invitation_url: invitation.invitation_url,
                presentation_exchange_id: proof.pres_ex_id,
                invi_msg_id: invitation.invi_msg_id,
            },
        };
    }
    async sendConnectionlessProofRequestV2(
        builder: ProofRequestBuilder
    ): Promise<ResponseCreateInvitationV1> {
        const wallet: any = await this.axios
            .get(`/wallet/did/public`, {
                params: {},
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(extractResponseData);
        //console.dir(['wallet', wallet])

        const proof = await this.createPresentProofV2(builder);
        const invitation = JSON.parse(JSON.stringify(proof.pres_request));
        invitation["comment"] = null;
        invitation["~service"] = {
            recipientKeys: [wallet.result.verkey],
            routingKeys: null,
            serviceEndpoint: this.config.serviceEndpoint,
        };
        invitation["@type"] =
            "https://didcomm.org/present-proof/2.0/request-presentation";
        return Promise.resolve(invitation).then((value) => {
            const baseUrl = "bcwallet://launch";
            const invitation_url =
                baseUrl +
                "?c_i=" +
                encodeURIComponent(
                    Buffer.from(JSON.stringify(value, undefined, 2)).toString("base64")
                );
            return {
                type: INVITATION_TYPE.CONN_1_0,
                payload: {
                    invitation: value,
                    presentation_exchange_id: proof.pres_ex_id,
                    invitation_url,
                },
            };
        });
    }
    async sendConnectionlessProofRequest(
        builder: ProofRequestBuilder
    ): Promise<ResponseCreateInvitationV1> {
        const wallet: any = await this.axios
            .get(`/wallet/did/public`, {
                params: {},
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(extractResponseData);
        //console.dir(['wallet', wallet])

        const proof = await this.createPresentProofV1(builder);
        const invitation = JSON.parse(
            JSON.stringify(proof.presentation_request_dict)
        );
        invitation["comment"] = null;
        invitation["~service"] = {
            recipientKeys: [wallet.result.verkey],
            routingKeys: null,
            serviceEndpoint: this.config.serviceEndpoint,
        };
        invitation["@type"] =
            "did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/present-proof/1.0/request-presentation";
        return Promise.resolve(invitation).then((value) => {
            const baseUrl = "bcwallet://launch";
            const invitation_url =
                baseUrl +
                "?oob=" +
                encodeURIComponent(
                    Buffer.from(JSON.stringify(value, undefined, 2)).toString("base64")
                );
            return {
                type: INVITATION_TYPE.CONN_1_0,
                payload: {
                    invitation: value,
                    presentation_exchange_id: proof.presentation_exchange_id,
                    invitation_url,
                },
            };
        });
    }
    async sendProofRequestV1(
        connection_id: string,
        proofRequestbuilder: ProofRequestBuilder
    ): Promise<any> {
        const proofRequest = proofRequestbuilder.build();
        return await this.axios
            .post(
                `/present-proof/send-request`,
                {
                    auto_remove: false,
                    auto_verify: true,
                    comment: "string",
                    trace: false,
                    connection_id: connection_id,
                    proof_request: proofRequest,
                },
                {
                    params: {},
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.config.auth_token}`,
                    },
                }
            )
            .then(printResponse)
            .then(extractResponseData);
    }
    findCredentialOffer(_connectionId: string): Promise<CredentialOfferRef> {
        throw new Error("Method not implemented.");
    }
    acceptCredentialOffer(_offer: CredentialOfferRef): Promise<void> {
        throw new Error("Method not implemented.");
    }
    receiveInvitation(
        _invitation: ResponseCreateInvitation
    ): Promise<ReceiveInvitationResponse> {
        throw new Error("Method not implemented.");
    }
    async createSchemaCredDefinition(
        credDefBuilder: CredentialDefinitionBuilder
    ): Promise<string | undefined> {
        const http = this.axios;
        const config = this.config;
        const schemas = await http
            .get(`/credential-definitions/created`, {
                params: {
                    schema_name: credDefBuilder.getSchema()?.getName(),
                    schema_version: credDefBuilder.getSchema()?.getVersion(),
                },
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            .then(printResponse);
        const credential_definitions: any[] = [];
        if (schemas.data.credential_definition_ids.length > 0) {
            const credential_definition_ids: string[] =
                schemas.data.credential_definition_ids;
            for (const credential_definition_id of credential_definition_ids) {
                const credential_definition = await http.get(
                    `/credential-definitions/${credential_definition_id}`,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${config.auth_token}`,
                        },
                    }
                );
                const credDef = credential_definition.data;
                if (credDef.credential_definition.tag === credDefBuilder.getTag()) {
                    if (
                        !credDefBuilder.getSupportRevocation() &&
                        credDef.credential_definition.value.revocation === undefined
                    ) {
                        credential_definitions.push(credDef);
                    } else if (
                        credDefBuilder.getSupportRevocation() &&
                        credDef.credential_definition.value.revocation !== undefined
                    ) {
                        credential_definitions.push(credDef);
                    }
                }
            }
        }
        if (credential_definitions.length === 0) {
            await http
                .get(`/transactions`, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${config.auth_token}`,
                    },
                })
                .then(printResponse)
                .then(extractResponseData)
                .then((data) => {
                    const results: any[] = data.results;
                    const transactions = results.map((value) => {
                        let _txn = value.messages_attach[0].data.json;
                        if (typeof _txn === "string") {
                            _txn = JSON.parse(_txn);
                        }
                        return {
                            state: value.state,
                            created_at: value.created_at,
                            updated_at: value.updated_at,
                            txn_type: _txn?.operation?.type ?? _txn.result?.txn?.type,
                        };
                    });
                    this.logger.info("transactions", transactions);
                });
            this.logger.info("Creating Credential Definition ...");
            const credDef = credDefBuilder.build();
            this.logger.info("credDef", credDef);
            return await this.axios
                .post(`/credential-definitions`, credDef, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${config.auth_token}`,
                    },
                })
                .then(printResponse)
                .then(async (value) => {
                    this.logger.info("Waiting for writing transaction to ledger");
                    await this.waitForLedgerTransactionAcked(
                        value.data.txn.transaction_id,
                        0
                    );
                    return value;
                })
                .then(async (value) => {
                    this.logger.info("Created CredDef", value.data);
                    const credential_definition_id =
                        value.data.sent.credential_definition_id;
                    //config.current_credential_definition_id=credential_definition_id
                    this.logger.info(
                        `Credential Definition created '${credential_definition_id}'`
                    );
                    credDefBuilder.setId(credential_definition_id);
                    return credential_definition_id as string;
                });
        } else {
            const credDef = credential_definitions[0].credential_definition;
            const credential_definition_id = credDef.id;
            credDefBuilder.setId(credDef.id);
            credDefBuilder.setTag(credDef.tag);
            this.logger.info(
                `Credential Definition found '${credential_definition_id}'`
            );
            return credential_definition_id as string;
        }
    }
    async startup(): Promise<void> {
        const config = this.config;
        if (config.tenant_id && config.api_key) {
            await this.axios
                .post(`/multitenancy/tenant/${config.tenant_id}/token`, {
                    api_key: config.api_key,
                })
                .then((value) => {
                    config.auth_token = value.data.token;
                });
        } else {
            await this.axios
                .post(`/multitenancy/wallet/${config.wallet_id}/token`, {
                    wallet_key: config.wallet_key,
                })
                .then((value) => {
                    config.auth_token = value.data.token;
                });
        }
    }
    async createOOBInvitationToConnect<T extends INVITATION_TYPE>(
        invitationType: T
    ): Promise<ResponseCreateInvitationV2> {
        const config = this.config;
        const http = this.axios;
        //const handshake_protocols: string[] = []
        //handshake_protocols.push(handshakeProtocol as string)
        const payload = {
            alias: `Faber\`s 😇 - ${new Date().getTime()}`,
            my_label: `Faber\`s 😇 - ${new Date().getTime()}`,
            handshake_protocols: [invitationType.substring(6)],
        };
        const params = {
            auto_accept: true,
            multi_use: false,
            create_unique_did: false,
        };
        if (invitationType === INVITATION_TYPE.OOB_DIDX_1_1) {
            Object.assign(payload, {
                protocol_version: "1.1",
                use_did_method: "did:peer:4",
            });
        }
        return http
            .post(`/out-of-band/create-invitation`, payload, {
                params: params,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            .then(printResponse)
            .then((value) => {
                this.logger.info("createInvitationToConnect", value.data);
                this.logger.info(`invitation_url=${value.data.invitation_url}`);
                switch (invitationType) {
                    case INVITATION_TYPE.OOB_CONN_1_0:
                        return {
                            type: INVITATION_TYPE.OOB_CONN_1_0,
                            payload: {
                                invitation_url: value.data.invitation_url,
                                invi_msg_id: value.data.invi_msg_id,
                                invitation: value.data.invitation,
                            },
                        };
                    case INVITATION_TYPE.OOB_DIDX_1_1:
                        return {
                            type: INVITATION_TYPE.OOB_DIDX_1_1,
                            payload: {
                                invitation_url: value.data.invitation_url,
                                invi_msg_id: value.data.invi_msg_id,
                                invitation: value.data.invitation,
                            },
                        };
                    default:
                        throw new Error("Unsupported protocol");
                }
            });
    }
    async createInvitationToConnect<T extends INVITATION_TYPE>(
        invitationType: T
    ): Promise<CreateInvitationResponse<T>> {
        switch (invitationType) {
            case INVITATION_TYPE.CONN_1_0:
                return this.__createInvitationToConnectConnV1() as Promise<
                    CreateInvitationResponse<typeof invitationType>
                >;
            case INVITATION_TYPE.OOB_CONN_1_0:
                return this.createOOBInvitationToConnect(invitationType) as Promise<
                    CreateInvitationResponse<typeof invitationType>
                >;
            case INVITATION_TYPE.OOB_DIDX_1_1:
                return this.createOOBInvitationToConnect(invitationType) as Promise<
                    CreateInvitationResponse<typeof invitationType>
                >;
            default:
                throw new Error("Invalid invitation type");
        }
    }
    async __createInvitationToConnectConnV1(): Promise<
        CreateInvitationResponse<INVITATION_TYPE.CONN_1_0>
    > {
        const config = this.config;
        const http = this.axios;
        return http
            .post(
                `/connections/create-invitation`,
                {
                    my_label: `Faber\`s 😇 - ${new Date().getTime()}`,
                    image_url:
                        "https://bc-wallet-demo-agent-admin.apps.silver.devops.gov.bc.ca/public/student/connection/best-bc-logo.png",
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${config.auth_token}`,
                    },
                }
            )
            .then((value) => {
                const response: ResponseCreateInvitationV1 = {
                    type: INVITATION_TYPE.CONN_1_0,
                    payload: {
                        invitation_url: value.data.invitation_url,
                        connection_id: value.data.connection_id,
                        invitation: value.data.invitation,
                    },
                };
                this.logger.info("createInvitationToConnect", value.data);
                this.logger.info(`invitation_url=${value.data.invitation_url}`);
                return response; //{invitation_url: value.data.invitation_url, connection_id: value.data.connection_id}
            });
    }
    async createSchema(
        schemaBuilder: SchemaBuilder
    ): Promise<string | undefined> {
        const config = this.config;
        const schema = schemaBuilder.build();
        const schemas = await this.axios.get(`/schemas/created`, {
            params: {
                schema_name: schema.schema_name,
                schema_version: schema.schema_version,
            },
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.auth_token}`,
            },
        });
        if (schemas.data.schema_ids.length === 0) {
            this.logger.info("Creating Schema ...");
            this.logger.info("schema", schema);
            await this.axios
                .post(`/schemas`, schema, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${config.auth_token}`,
                    },
                })
                .then(async (value) => {
                    this.logger.info("Waiting for writing transaction to ledger");
                    await this.waitForLedgerTransactionAcked(
                        value.data.txn.transaction_id,
                        0
                    );
                    return value;
                })
                .then((value) => {
                    schemaBuilder.setSchemaId(value.data.sent.schema_id);
                    this.logger.info(`Schema created '${value.data.sent.schema_id}'`);
                    return value.data.sent.schema_id;
                });
        } else {
            schemaBuilder.setSchemaId(schemas.data.schema_ids[0]);
            this.logger.info(`Schema found '${schemas.data.schema_ids[0]}'`);
            return schemas.data.schema_ids[0];
        }
    }
    async sendCredential(
        cred: IssueCredentialPreviewV1,
        credential_definition_id: string,
        connection_id: string
    ): Promise<string | undefined> {
        const config = this.config;
        const http = this.axios;
        this.logger.info(`Preparing Credential Request`);
        const data = {
            auto_issue: true,
            auto_remove: false,
            connection_id: connection_id,
            cred_def_id: credential_definition_id,
            credential_preview: await cred.build(),
            trace: true,
        };
        this.logger.info("Credential Data", data);
        return await http
            .post(`/issue-credential/send-offer`, data, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            .then((value) => {
                const credential_exchange_id = value.data.credential_exchange_id;
                cred.setCredentialExchangeId(credential_exchange_id);
                this.logger.info(`Credential offer sent!  ${credential_exchange_id}`);
                return credential_exchange_id;
            });
    }
    async waitForOOBConnectionReady(invi_msg_id: string): Promise<ConnectionRef> {
        const { connection_id } = await this._waitForOOBConnectionRecord(
            invi_msg_id,
            0
        );
        await this.waitForConnectionReady(connection_id);
        return { connection_id };
    }
    async waitForConnectionReady(connection_id: string) {
        this.logger.info(
            `Waiting for connection ${connection_id} to get stablished`
        );
        await this._waitForConnectionReady(connection_id, 0);
    }
    async waitForOfferAccepted(credential_exchange_id: string) {
        const config = this.config;
        const http = this.axios;
        await http
            .get(`/issue-credential/records/${credential_exchange_id}`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            .then((value) => {
                this.logger.info(`Credential Exchange state: ${value.data.state}`);
                if (value.data.state !== "credential_acked") {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(this.waitForOfferAccepted(credential_exchange_id));
                        }, 2000);
                    });
                }
            });
    }
    async sendBasicMessage(connection_id: string, content: string): Promise<any> {
        return await this.axios
            .post(
                `/connections/${connection_id}/send-message`,
                {
                    content,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.config.auth_token}`,
                    },
                }
            )
            .then(printResponse)
            .then(() => {
                return this.axios.get(`/basicmessages`, {
                    params: {
                        connection_id,
                        state: "sent",
                    },
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.config.auth_token}`,
                    },
                });
            })
            .then(extractResponseData)
            .then((data) => {
                const results: any[] = data.results;
                return results.find((item) => item.content === content);
            });
    }
    async waitForBasicMessage(
        connection_id: string,
        receivedAfter: number,
        content: string[]
    ): Promise<any> {
        return this._waitForBasicMessage(connection_id, receivedAfter, content, 0);
    }
    private async _waitForBasicMessage(
        connection_id: string,
        receivedAfter: number,
        content: string[],
        counter: number
    ): Promise<any> {
        return await this.axios
            .get(`/basicmessages`, {
                params: {
                    connection_id,
                    state: "received",
                },
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(printResponse)
            .then(extractResponseData)
            .then((data) => {
                const results: any[] = data.results;
                const item = results.find(
                    (item) =>
                        Date.parse(item.created_at) >= receivedAfter &&
                        content.includes(item.content.toLowerCase())
                );
                if (item) return item;
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(
                            this._waitForBasicMessage(
                                connection_id,
                                receivedAfter,
                                content,
                                counter + 1
                            )
                        );
                    }, 2000);
                });
            });
    }
}
