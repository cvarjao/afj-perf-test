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
    shortenUrl
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

    async sendOOBConnectionlessCredentialOfferV1(
        cred: IssueCredentialPreviewV1,
        credDefBuilder: CredentialDefinitionBuilder
    ){
        try {
            const config = this.config;
            const http = this.axios;

            const credential_payloadV1 = {
                auto_remove: false,
                comment: "Test",
                // credential_proposal: await cred.build(),
                "credential_proposal": {
                    "@type": "issue-credential/1.0/credential-preview",
                    "attributes": [
                        {
                          "name": "given_names",
                          "value": "John"
                        },
                        {
                          "name": "family_name",
                          "value": "Doe"
                        },
                        {
                          "name": "picture",
                          "value": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wIAAgEBAYMfoZkAAAAASUVORK5CYII="
                        }
                        // {
                        //   "name": "picture",
                        //   "value": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAY+0lEQVR42u1dCXhUVZYOrW339LQ9n35uQ2MMoVJvrUAIkKr3qiqVvRJRFkV22UGUTXawEVni2jraLq0ztOO0tk5r2y5tj9iOiuIyitq2+9YKIqgo2IoQFvHO+d9SdauSAGpeLcm933e/qlQqleSec8/5z3/OPbegQIzDGrIvVKkpxkZNi7zv9w/oLVakCw1Jqhij6+Eduh5lgUAlUxXzYXr5CLEyXWAoSmgO7fq9gUCU6XqEQQlUxdhSVBT7sVidzm72ZWMeCf1rCN0VPj0ekOXQYvp2N7FCnXhoijmZhL3fFnyEwQKQJWjxy6EZYnU6u9kvqagjYe90d75t/o1dilIxQqxOpzf7fYo0PfJe0udHmKZE9wAIitXp9CN2pKwa9wHpu8Kn+Y0mzH7XGKoanaZzOx+KoKnmtWJlusDoXlxeSH5/K+/3NdV41ufz/UysThcYumreyJt+TY18pSh9g2JlusDwqf3KSOhf8aZfUoxLxcp0Gd9v3Jbc/Yj3jfd7nWicIFamC4xevQxdVRHzc4SPQP1dZyhK+OqU3a8a7xYWFh4jVqYLjB49tGMJ7G3mkb8iGQvb/4nyH4IoIkYw6FeDjbIcHqlL5iRNNqaoyBjK4YH4Xg9/75+L1c2L3R8ZkUz0RJiqhrdrWnmh+/2ioqIfU2g4gOoAziVccIemRF7WNPMjep+VHYTlSJ1RfMZeS6kUY52mhJbJ8oAQFEesdu6Nbqoauss1/3ikHX0jvkHZPoNcw2Uk+JdJ6Htc4dr0cJRnCduc7nttIim8j6jlp1U5Os13UuR4sew5Mkp9FT3sIg8n7tfCBxAN0A5/DEJzhc4LVpNNpvoMe5YY1tfWVJxHv2m9rhYb1vN0hSCw+Q6yiZIkHS0kkOURkEOj0ndzcpc7r6kRW6AkcDLrrF9DPYtNHcKaVo5hZ948jY3+02w2ft18NnH9QjbukXls1D2z2JBfT2Z1i0aw4JC4/fP4WcVM+/zwM35/qEZIwYNxilL+rwBiVMkzhHb0LJq/JDN+C5nzB8jnP07C+D9VM17U1fDH7ZlwayeT4AJ9KllkzOns9CsnWAI+59VlbNaHq9mcTy5msz9qtudWbuLrjzEvZue+vZyd/dBcVr9kBOsTillWAQrB1xaoqtl84oml/yyk9h2HpmlHyXJFuaYFx1H4dhMJeQMAWNJvJ8FZ+mzLl1tmnYRfMTDOTvvleDbhyYVsxsaVtsBJwLO2rGYzN69iMz849ISiuAoy6dnFrGHZKNa7T9T6HW7I6eQb1mrFSeApxiFGcXH5vyAEQ/yuK+bfQOGmC/pQIK1N4FYaZdFxg9iI/z6PTX9zubWLZ209fIEfVBm2kPKQIpz98FxmjhhoWZekNSCgqJmv+pRgXyHd9scRkhQ0qUbvGhA17sK1JWyFFrZEibBiyZ54LtFrsmp/T1PbUAB6T1moik16bjE7/9NLrN37fYXe1oRFgGsAhqA0M4cNqNJYC2/y+8vDQtTcKCwMHEOh2kRVM9cTSt/bltAhWAjap9jPI32jbHSkks2Px9gVQ6vZrWNr2ANTatnjM+rY83Ma2Ovz69nK06tYsdLa/NfMGcZmbiJhfbjKEwWwrcFqyy0M+6/prHd5pRU9JC1BeIvNG3TxQfz8CYpkLtCU8FttmXXJEToEXj8gyuaSsNeMqmHPzGxgG5fE2WcXNrI9q5vY182nsn3NTWwfPd/rzJZVTWxeY5WlMG1hgMHXTbJ2qlcKYE1yKwCLo++fzcqMqkTIaCtB5H1FMfQuKfhjj/X9TNHDsykOfzdd8DDfxc4uHxSMskuGVLHHz6tjH17QaAl1f3NSwLtpfrWy9dxFr28n5Ti1Imp9joX4dc4tKDYWGHnPTEtAnioBXALhjLFrz7eVQE6GisA2iGa6lPD9SmiwpoefTzfzrokPEYJeRDv3kXPr2CfLGhO7GgLftbJtgadPvPfdRXFW0dvBA/T5/em5+7VL9kAg4x6dnxElmENKMOaBOay0fywFE1BEcy+o6M4fyvXq61Pk8O1g4loJnnZkHZn4a8+qZm8tjFsChODb2+GHmlCYp8lNBAK28CX6/Gk1MXbnhJoUS6D6DVZeXcfGP7EgQ5agmQ2/4zym4+9SOWCoBpd3auFLkjGBkixbWpl62vG1/aLsppHVbPPSuOXHW1Yf/k5vb8JN3DepNuH/8XsACPH51w2vZj7JVgwXD5TXkBI8Nt8y1Z5jAsIdp181geMJIvZBlM7IGBYV9T8J7Fzy0IX9D0Mw/ckHX3lmtQXmILCWVd9P6OkKcDOBxUIHdBWRwP+DlOxren3niia2wokOeCUoM6ssitcChh6Fh9akyAOkU/XMM22ewGUMKQOJaKgTsXf9BtCu/ytfgCk7sfuM+hh7aW59wrd3lOATGIA+97Ih1aynlFS4P06stRQAv+/zi+JscVOVZRk0jhYO9I6yQVdPtASEEM4zV0BKds5ry9iApoaU8LDT1CdSmnUU+frt6bs+SrH778fXsC9X2H66owVvRQA0d9Jc5ISArs9/jEAlXICrIJ8vb2QXDExTAsXO8lVOGszGP77AEpRFC3ckN/CxTRKdddt0Vl5bl1AAi7JWwzsoVe3PZ9l3U3Rzga6b+13ha44Pnlods8gZmOfdq7wRvqsAX5CC4feVOApQRqDrBSKH9qxOjRTwPpBIAIkKxxzCNJf2i7HGVWPYlBeWJpJA35ouhs/faieO8HzSc0vYkBsms+CguJ2PUMxWHIXf3zeSl5KP0XErqoy5PB3hY2GvIl+PHefVrk9XgM8vamJnhSstIskKAUsj7E0nuuDfu9vhEm4fV0NhYtRSGJ23BpTZK4tUkyKMttLBM95fafH9AIuudeCnnSVMfu/cdy6in1vAhtw4hUUnDk5kC/kagmT6GDSx+T8+X0X+HVChUzU/wtEqXvjYVUFa1HsJje9Z7e2ub0UCkbI1DbBJIJj/UFmUbVoSbxNvQGEQcj43q4ENJ2q5OM0a2IoQopRxlIXOaGTx5aMt8w1iZ8JTC61djYnnSAKNuGsGG3ztJItuho/v3ZcE2zPU5o53STDiRd7AcbXu3ct/ko97/8h04WMnIbx7imJxmPxdHu309hRgG7GAleVRS5CYJinAx79oPKgS7m22f+5Xw6q/rigNH+jpUNB80YhVP1BsWAqBWL5PRcwikzDxHCAS7kOGwH12JZGutp+ZVPXwK+hMks/ov1u62QfwGkgU7ivz7PDOC8HDouxc2TYdjK+3krCRLHIVoJqUAcJtTwHweos1G7850Bzf9uaChv2XEzaI0c/h//FxIWOKQihmymxP2C7ZpaR8P/yNogw4P6/Rvi6b8/mCCyzUUKOSvbkgnkDcHQ7wyL/fMqaGjY1WsquHVbN/UEjHCxbPkTcwOQVAIunTdhQAgsdnXEOfNTocPbBmZPUevI6/f9PiOPvd2bUWoKxwMEJPJ/WcSDvryYnX4PqKnfcBgwTo9Tj9/tkU+kIRJT45FYj8g/ISp+al8NFFg/6JfbzZH0jJF6+E7wpl7dRaVkSmGMoGggcAE4J1ASYEunlpo2X2Fac+AAL4LE0BdjmfB+FfOrjKEpj9mSZ7kH6HS07hEWHr2wQi755Qyy4iEmliVaWVaDLLqH6QAGY5TYN+HxRtJOGI2Q0xdiklsf5A739pbtyySPgsuES8T04tGfuopKR/nzyL81GeFfnUNf0l9A/V9LPN/j4PkT6InDtpUU92ULS760DqvDbftgRfX9xkJZF4BYBgdiAKabaFjvkFCf5Jqh3gw0V8Jj779+Nt0ohXFj4TiSgDmOIDUrSNS+yJ51vJ8kDR3L8V79/DJbLw9V+m1bM+gaQ7sKqIlcgL/vLYcfmRzaM/1Gb4ogn/BvP4pAP4vET4WMhNtNiDQ5UWt+AqAbh9ZPrm0M7DrgPpY5QlXQB8+XtkzpFoWkep5ZtG1rAx0cqE5XKtGD5ziFlp/Y6DMZRu+NjSxtx9iKwlNgjCTllNKp2dEDJuK8iDnoTdVNm42aV3NWeBQbN6LXw+0/cy0cinEdDsybF4+Dt8ju/FDgukhFu2hXKVAq5D4nY9HvFzZ5DwYUm85Ctca3IpUdV8tZJlCUpC03Ib9PmNsTzowz9wJaHljsjgfVslQBJpCVG5mpNV5FG61g4SV9TU77kZSSjMikFVVkYyE2RVi8NVTKmuTGQsHTzwmRwIBXIU9JWdwqd0Ifwp5D/hW1tWZU74/CJC6daTSYfpT0fp6QgdX0uclZCd8HA5gTrQxK4Jz6QSv07WprJvOigMP4gy+FyT/w+obeqtrulXnKLMV+fVZ2THHMyc7nWsD/z7HeRbkeBBiAjgF+xto3Q8QthDzSg7t9YuIn1war0VLcB67cmwBePT1nCfUgoewNGyHHMFiFX5bprYRQAymfL7h+tXXdS9Y3kT+4hQOgQMdI7HLYTQQQahHmC/Ewl8mzIzL6YLGBc0xhJ4wD5EEtmcM0fPjz9e+ynV6D/nmn4IH7voizQCJlfmrnZQ+u7DQOjZmFBYWC9Q1zJ3iESRQ1flRjmXEpnOm36QHi+Sz8ym6e9sExYJ7KYb2lodTJTwF1kHhEhSuDX7bpx8OYUve1fn3k7K59niJLCQwi5ROG5AN36TVQXAqVue8HEJlRax+z2xAn+eXMvlCqw+AzuzdmsJmhtQgcKr/O6/nipq9zULYXkFCFGreHYslmIFKF18XXZ2v2SOdkkfK2YmJg3ki9j93k1srj9PSVoBOyIIfyLLwaIMi3/YEUT6PMrvfmTdxO733gogbT3MtMvZEqeH5ODczJZ0F/fvTwULuy00qtuJFrBWYvdnBgv8lk468xQxyeL5Hj1C/5Q58y+bV7ihHwgKnMrNxRi6s0YEfyegjRJ6JVk9tA/X2WWS+HndNf/wRw9RDluY/8wRWSCHrDMLfEioGVdmCP0b1S7tC/DXRJUvWy7ITsKnK4PBh6fXcdGA1WPo9Yw0mqKmBZclzD+BP5yj2yd8f8bdADZdI9ffgDiBvZIUMb0FfwXaUTzvDw38X9JEoQDZyXIudY6uJbuKGIu8VQBfRFWJgwb6d/PlG5cI858tN3APHarh3YBzla2X1G/wLNf8IwyZUSvQfzazhKiwRmcTLYEDzA969qw40cNq3+A1fPh3A1G/+wX6zxophArjkZGUM4v7Vb8Z8dACmOt5/4/mTCLtm0U3QGv/i9NScQDOEHp1wPN43KFjXaZAvyxEpucdKlTYIxQgy6xgbVrhqHGDNwqghso0ujfXJX+Qm962rDEnq366yoT1XT+jISU5pCvhdR4RQOE4H/+jjYtA/7lRLobCVlRjOXmBNzwhhOg+nKm8AqwaJABgLhBCOKuQJITss4SepIc1JbiKDwF/Q122BP+f/UhgO1U4j45WcpGAsavUi47juh76NR8B3E316oIBzD4jiMfpNcmycTo4Qn0FjGjHK4AavpNXACQjRAiYG4zgPErH9+RCQU96CuBGCz4F/PRMoQC5MHHMfFkaF6D4o8M7XgG4EjAowIbZovY/V7iAlYNSFUD3h8d6YAHMJ3kF+Ov59UIBckQBLsFRck4BJLrFtONpYMV4gleAF8Tpn5xRgObBqRZALjHGe6AA5sO8Ajw7W2CAXFGAi9IwAO4y9oAHMP7ERwFPiERQzijA4qZYmgIEh3pRCvZbXgEemCx4gFw59j6zPsa1k6FkXUlFXccrAB1H5pnA28fVCiYwB5hA9EVEWzo3I4j7jnFjqhdh4CK+GASNE0UuIPu5ALSjQ2cTyc0F6JHPqaG06oELCA7nk0HwO0IBsqwA5ILfsw6JJLOBdD7g/ZN8HlxPj1Ij8MwuBoDZ+XJFXNQDZLkeAHxMSv8guhDbk36CihItoY6Vn7kVwY3UZOmDpXFRE5DlPMB9k1Mrg6kp9d2eFITg8CFxAYl+AGi0+Le5gg3MdgiIU9mpNYFh766Yo4TQfXwzKLQwE5FAlkJAWN4VSAWnNpOkPs1neFgWHlqcfixMAMHsRQBwwXX9ktVARNd/Qfcte3ffsOIP1vJAEK3Pt18oCkOzBQDRzVxO6SpuvurpNbMnn1zWnSqDP7TvsbF76L5M3UBFaXh2/P81Z6X5f9242fvuIFxOAIQQulUIN5CthlHp/t+DJFBrRjA0g6eEp1FH650uKBHCyVg5OG5W7eNcfh2wqoGN7T5feS/vFYBoRgIbX7r9gVCTjv5Awg1k1vzfMKKGM/9Wg4i1JJ5uGekQRg0iH+HdwI0jhBvI9KHQYegaqqb0BpiawQ6hoWmuG0ASAjdpfCqigYwdCMWVN2no/1NJKu2ZMQX4ua+iB06gJCqE6I9ZO7VWWIEM5P+xyeZT+3gf3yBKDf0u451CKRr4dx4MnkOMFHrtCzDoNfiLWx3ZE/cZaZEDsjygIQuNossr7GaRzh9DVmD9jDpBDXtZ/UMKAPaVB390vewznpI/Bxk/kDlOAFeznUctY0RI6B3zh9vQ+pemXh8jyx5UAB82NRwI1ro9AzXnmrhHpgsr4FXt39KU5pAAf+FXqHFHVq+TPyK9WniMyA94gvyfpEYQAT1190tqeGJBtoffHw4TEGnhL4wS9HDHxv24em98rDK98OP5jHQGPbyIwFyTfmXcG/Pjolikg6p+/hP3BXG3iAL5a5p5ekGuDHDQPC+APxaXNSIsFK7gewC/Zhv4tbpRXDb/CEa2IJeGpoTOcxXAxQO3ClfwvQo+YPonViVJH/uGFnNbSUlQKci1QWj0RwQIH+JdAa5r3TBbRAXfBfWD9Ll6WPoF0tYdQXMKcnWovv4adRL5OKAno4KhlCdA6ZLIFn67bB+O3ml66hXytMEewEYryOUBYoLwwDeJG8QlGw+ggEGUkB8e6MPRezPN79PjZq1XX19BHoxumhS+3nUFrhJcTGfYd60SoPBQ8f67i+JsYJDv+mVfCeNXQoML8mUcd5x0NIUpj7mgUHPcAe4VtO7pFcJuk+qFqwSR5kvx+0T4KKFlBfk2JGlAT3StTCiBal8xs4b6CwIPCEuQKnzcAILjdumgT1Mit5SXl/+wIB9HcfGAflRGvoVXAkQHN42sSdzYLcx+k3WFfWvhg+0zHpLImhbk8yj1h2oIFH7GKwEKSHC8HERRVwaGED46ro8ms5+8GTyB+J/qdaJxQkFnGOT/TyV3sIPHBPBz6G+HUrKuRhnvckK95wntD6Q+v750s69GnkPVVUFnGug2Tv5sG88WQusnVcfY27QLsCC7ugjDBwx0P8X5oHhL0oRPF3Kv73TC584WVmpKeGNKiEgLUE9HzXH7GBamM7sEWDpU9P4bnejVnHsXU3e+sbZXr14nFHTmgcOLGt11yysBMAFy3TjqjEso9nUyawCwCwv3EjVzGB+zO3ppepLft0u7jJuPy3fAd7gDN1sRMPyD7Q6SuAALgwOnqC20rMHqzuHrt1NSB+FvsHe0VYyvKdE9kmJcUFAQO7KgKw1w2qocXI5ikvQsYu8ALqSoYn9fZGODfHML7sWO2PnrqIZ/bNRG+YqaKnxq5rAprxg+T3CBFmogJXiddwmuNYjRxZRriDPYQnFyPiiCK3j8nejds7CxKqHUeprJp6jonoyc5cuHUVTU/yRdNW8k0mgvbw0AkqAIuKAaVTGblsSt2BnuYVeO+XgXtyC0Q3iL2n0A3KSvd4Fe+BO6gHOmpmlHCcmn1xeqwUb7buJK1pYi1FI3jCsJKOJk7E7Hv7ZkSRl2O+Ec/gYA179Mq2WzKeuJE7sWyEsz9/T4NZ3fu4M6eUtC0gflC6SjFcU8nxbwA9sttFaEMlrk6XQG4a4Jtexd4hBcsLXXwzDSLc3e6wgd1TobaLf/ihjNIaFKK5LxtdrxCZD7tC6HBwrpfosBMkRSzJW0a7akWwSXSYQyoAAVB1JuIRfxIvndrRfYl1nvcxTCVYrDuePYPXvnkjX42X2OwL9cYTdlfJRA3RVDq9lIOp0bcLCKlOLjbcG7Pfs0f3Bc9+7dfyIk+h2HppUX0rGzpUQgveUuLL/YippUBgjktGCUzabmydcPr2EPTq233AVy7J+QmUZfXbgMKEerudo+0bSDbuH6kJQIFzM/O6vBsjK4kGECJWsASgHo4NtL2tjt9jHt8AFdMdaRqR9Nfv6nQoIdNHr00I5VpYoxtMAP0v24O9OtgmsZXFPsTrwOweEI+zgiYXDDFi5ZWkKnbC4ksAbAtripis0hpZlCtDSuYBtIShQqs3e2zxE4Hvkwjkf0zimdLVQDsYYEXxXrajF95nFCRSn1w1lMuYWnVDWy0xVCukK4SgHBSc6uda1FsdJ6+pz3yGpbwk4VuH1Pb2SrokTu1bTgOK24vFBIJvPjiEBxKEC3mk4hUuUuSqS8RruwhRdSe4px8Nn6523ixthONPYGXNDsVyKD6Q6FU4QIcotd/BkuuaZdOULVzYsp5r6f8uobSKjv0fwcvfTbEmyqkhi76aTTNrqE+U3a4U+peuQ2RTMW+pWKJrk47C8Q5j3fRuxI5B78/pCsU4USuY8q0K/UVGEUbteiNPUEaoA5HALWpIhZUmL0AUNXWBg4piut0v8D1HLTMIZOOhsAAAAASUVORK5CYII="
                        // }
                      ]
                },
                "cred_def_id": "5KehwV8mjSMM6YcC7RpFmA:3:CL:2583308:Revocable Credential",
                "issuer_did": "5KehwV8mjSMM6YcC7RpFmA",

                handshake_protocols:["https://didcomm.org/connections/1.0"],
                trace: true
            }

            
        
           let create_invitation_payload = await http
            .post(`/issue-credential/create`, credential_payloadV1, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            .then(extractResponseData);
            create_invitation_payload['handshake_protocols'] = ['https://didcomm.org/connections/1.0']
        

            

            let oob_invitation_payload = {
                "attachments": [
                  {
                    // "id": create_invitation_payload?.credential_exchange_id,  // For v1
                    "id": create_invitation_payload?.cred_ex_id, // For v2
                    "type": "credential-offer"
                  }
                ],
                label:'vc-authn-oidc',
                // removed handshake_protocols so connection will not create

                // "handshake_protocols": ["https://didcomm.org/connections/1.0"],
                "use_public_did": false
              }


            const invitation: any = await this.axios
            .post(`/out-of-band/create-invitation`, oob_invitation_payload, {
                params: {},
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(extractResponseData);

            invitation.invitation_url =
            "bcwallet://launch?oob=" +
            encodeURIComponent(
                Buffer.from(JSON.stringify(invitation.invitation)).toString("base64")
            );


            let Url:string = invitation?.invitation_url
            let ShortIvitationUrl = await shortenUrl(Url)
            
            return {
                payload: {
                    invitation: invitation.invitation,
                    invitation_url: ShortIvitationUrl,
                    credential_exchange_id: create_invitation_payload.cred_ex_id,
                    invi_msg_id: invitation.invi_msg_id,
                },
            };

        } catch (error) {
            console.log('Error at Send OOB Cred Issue 1.0',error);
        }
    }

    async sendOOBCredentialOfferV1(
        cred: IssueCredentialPreviewV1,
        credDefBuilder: CredentialDefinitionBuilder
    ){
        try {
            const config = this.config;
            const http = this.axios;

            const credential_payloadV1 = {
                auto_remove: false,
                comment: "Test",
                // credential_proposal: await cred.build(),
                "credential_proposal": {
                    "@type": "issue-credential/1.0/credential-preview",
                    "attributes": [
                        {
                          "name": "given_names",
                          "value": "John"
                        },
                        {
                          "name": "family_name",
                          "value": "Doe"
                        },
                        {
                          "name": "picture",
                          "value": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wIAAgEBAYMfoZkAAAAASUVORK5CYII="
                        }
                      ]
                },
                "cred_def_id": "5KehwV8mjSMM6YcC7RpFmA:3:CL:2583308:Revocable Credential",
                "issuer_did": "5KehwV8mjSMM6YcC7RpFmA",

                handshake_protocols:["https://didcomm.org/connections/1.0"],
                trace: true
            }

            
        
           let create_invitation_payload = await http
            .post(`/issue-credential/create`, credential_payloadV1, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            .then(extractResponseData);
            create_invitation_payload['handshake_protocols'] = ['https://didcomm.org/connections/1.0']
        
            let oob_invitation_payload = {
                "attachments": [
                  {
                    // "id": create_invitation_payload?.credential_exchange_id,  // For v1
                    "id": create_invitation_payload?.cred_ex_id, // For v2
                    "type": "credential-offer"
                  }
                ],
                "label":'vc-authn-oidc',
                "handshake_protocols": ["https://didcomm.org/connections/1.0"],
                "use_public_did": false
              }


            const invitation: any = await this.axios
            .post(`/out-of-band/create-invitation`, oob_invitation_payload, {
                params: {},
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(extractResponseData);

            invitation.invitation_url =
            "bcwallet://launch?oob=" +
            encodeURIComponent(
                Buffer.from(JSON.stringify(invitation.invitation)).toString("base64")
            );


            let Url:string = invitation?.invitation_url
            let ShortIvitationUrl = await shortenUrl(Url)
            
            return {
                payload: {
                    invitation: invitation.invitation,
                    invitation_url: ShortIvitationUrl,
                    credential_exchange_id: create_invitation_payload.cred_ex_id,
                    invi_msg_id: invitation.invi_msg_id,
                },
            };

        } catch (error) {
            console.log('Error at Send OOB Cred Issue 1.0',error);
        }
    }

    async sendOOBConnectionlessCredentialOfferV2(
        cred: IssueCredentialPreviewV1,
        credDefBuilder: CredentialDefinitionBuilder
    ){
        try {
            const config = this.config;
            const http = this.axios;


            const credential_payloadV2 = {
                "auto_remove": false,
                "comment": "Test",
                // credential_preview: await cred.build(),
                "credential_preview": {
                    "@type": "issue-credential/2.0/credential-preview",
                    "attributes": [
                        {
                          "name": "given_names",
                          "value": "John"
                        },
                        {
                          "name": "family_name",
                          "value": "Doe"
                        },
                        {
                          "name": "picture",
                          "value": "data:image/png;base64,data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wIAAgEBAYMfoZkAAAAASUVORK5CYII="
                        }
                      ]
                },
                "filter": {
                    "indy": {
                        "cred_def_id": "5KehwV8mjSMM6YcC7RpFmA:3:CL:2583308:Revocable Credential",
                        "issuer_did": "5KehwV8mjSMM6YcC7RpFmA",
                        // "schema_id": "96zT71QGmKbwZiWXdkGqRN:2:Person:1.1",
                        // "schema_issuer_did": "96zT71QGmKbwZiWXdkGqRN",
                        // "schema_name": "Person",
                        // "schema_version": "1.1"
                    }
                },
                // handshake_protocols:["https://didcomm.org/connections/1.0"],
                "trace": true
            }

            
           let create_invitation_payload = await http
            .post(`/issue-credential-2.0/create`, credential_payloadV2, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            .then(extractResponseData);
            
        

            console.log('create_invitation_payload after added',JSON.stringify(create_invitation_payload))

            let oob_invitation = {
                "attachments": [
                  {
                    "id": create_invitation_payload?.cred_ex_id, // For v2
                    "type": "credential-offer"
                  }
                ],
                label:'vc-authn-oidc',
                // removed handshake_protocols so connection will not create
                
                // "handshake_protocols": ["https://didcomm.org/connections/1.0"],
                "use_public_did": false
              }


            const invitation: any = await this.axios
            .post(`/out-of-band/create-invitation`, oob_invitation, {
                params: {},
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(extractResponseData);

            invitation.invitation_url =
            "bcwallet://launch?oob=" +
            encodeURIComponent(
                Buffer.from(JSON.stringify(invitation.invitation)).toString("base64")
            );


            let Url:string = invitation?.invitation_url
            let ShortIvitationUrl = await shortenUrl(Url)
            
            return {
                payload: {
                    invitation: invitation.invitation,
                    invitation_url: ShortIvitationUrl,
                    credential_exchange_id: create_invitation_payload.cred_ex_id,
                    invi_msg_id: invitation.invi_msg_id,
                },
            };

        } catch (error) {
            console.log('Error at Send OOB Cred Issue 2.0',error);
        }
    }

    async sendOOBCredentialOfferV2(
        cred: IssueCredentialPreviewV1,
        credDefBuilder: CredentialDefinitionBuilder
    ){
        try {
            const config = this.config;
            const http = this.axios;


            const credential_payloadV2 = {
                "auto_remove": false,
                "comment": "Test",
                // credential_preview: await cred.build(),
                "credential_preview": {
                    "@type": "issue-credential/2.0/credential-preview",
                    "attributes": [
                        {
                          "name": "given_names",
                          "value": "John"
                        },
                        {
                          "name": "family_name",
                          "value": "Doe"
                        },
                        {
                          "name": "picture",
                          "value": "data:image/png;base64,data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wIAAgEBAYMfoZkAAAAASUVORK5CYII="
                        }
                      ]
                },
                "filter": {
                    "indy": {
                        "cred_def_id": "5KehwV8mjSMM6YcC7RpFmA:3:CL:2583308:Revocable Credential",
                        "issuer_did": "5KehwV8mjSMM6YcC7RpFmA",
                        // "schema_id": "96zT71QGmKbwZiWXdkGqRN:2:Person:1.1",
                        // "schema_issuer_did": "96zT71QGmKbwZiWXdkGqRN",
                        // "schema_name": "Person",
                        // "schema_version": "1.1"
                    }
                },
                // handshake_protocols:["https://didcomm.org/connections/1.0"],
                "trace": true
            }

            
           let create_invitation_payload = await http
            .post(`/issue-credential-2.0/create`, credential_payloadV2, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            .then(extractResponseData);
            
        

            console.log('create_invitation_payload after added',JSON.stringify(create_invitation_payload))

            let oob_invitation = {
                "attachments": [
                  {
                    "id": create_invitation_payload?.cred_ex_id, // For v2
                    "type": "credential-offer"
                  }
                ],
                "label":'vc-authn-oidc', 
                "handshake_protocols": ["https://didcomm.org/connections/1.0"],
                "use_public_did": false
              }

            const invitation: any = await this.axios
            .post(`/out-of-band/create-invitation`, oob_invitation, {
                params: {},
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.auth_token}`,
                },
            })
            .then(extractResponseData);

            invitation.invitation_url =
            "bcwallet://launch?oob=" +
            encodeURIComponent(
                Buffer.from(JSON.stringify(invitation.invitation)).toString("base64")
            );


            let Url:string = invitation?.invitation_url
            let ShortIvitationUrl = await shortenUrl(Url)
            
            return {
                payload: {
                    invitation: invitation.invitation,
                    invitation_url: ShortIvitationUrl,
                    credential_exchange_id: create_invitation_payload.cred_ex_id,
                    invi_msg_id: invitation.invi_msg_id,
                },
            };

        } catch (error) {
            console.log('Error at Send OOB Cred Issue 2.0',error);
        }
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
        // console.log('Credential Data that created:',JSON.stringify(data));
 
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
    async waitForOfferAcceptedV2(credential_exchange_id: string) {
        const config = this.config;
        const http = this.axios;
        await http
            .get(`/issue-credential-2.0/records/${credential_exchange_id}`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.auth_token}`,
                },
            })
            .then((value) => {
                console.log(`Credential Exchange state V2 1: ${value.data}`);
                console.log(`Credential Exchange state V2 2: ${JSON.stringify(value.data,null,2)}`);
                console.log(`Credential Exchange state V2 3: ${value.data.cred_ex_record.state}`);
                this.logger.info(`Credential Exchange state: ${value.data.state}`);
                if (value.data.cred_ex_record.state !== "done") {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(this.waitForOfferAcceptedV2(credential_exchange_id));
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
